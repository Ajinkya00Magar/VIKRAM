"""
PS13 — Predictive Analytics Engine
Ensemble of Prophet (trend), IsolationForest (anomaly), XGBoost (classification).
Outputs: issue_type, confidence_score, risk_score, time_to_impact, affected_scope.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import uuid4
import structlog

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

from models.schemas import Prediction, IssueType

logger = structlog.get_logger(__name__)

# Suppress cmdstanpy verbose logging and pandas FutureWarnings
import logging
import warnings
logging.getLogger("cmdstanpy").disabled = True
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
warnings.filterwarnings("ignore", category=FutureWarning)
try:
    import cmdstanpy
    cmdstanpy.disable_logging()
except ImportError:
    pass

# ──────────────────────────────────────────────────────
# FEATURE DEFINITIONS
# ──────────────────────────────────────────────────────

TELEMETRY_FEATURES = [
    "cpu_utilization", "memory_utilization", "bandwidth_utilization",
    "packet_loss", "latency_ms", "jitter_ms", "error_rate", "qos_drop_rate",
]

ISSUE_THRESHOLDS = {
    IssueType.CONGESTION:         {"bandwidth_utilization": 80, "cpu_utilization": 85},
    IssueType.LATENCY_DRIFT:      {"latency_ms": 50, "jitter_ms": 10},
    IssueType.TUNNEL_DEGRADATION: {"packet_loss": 2.0, "latency_ms": 80},
    IssueType.MPLS_FAILURE:       {"packet_loss": 5.0, "error_rate": 3.0},
    IssueType.BGP_FLAP:           {"error_rate": 1.0},
    IssueType.POLICY_DRIFT:       {"qos_drop_rate": 5.0},
    IssueType.ROUTE_INSTABILITY:  {"error_rate": 2.0, "latency_ms": 40},
}

TIME_TO_IMPACT_MAP = {
    IssueType.CONGESTION: 45,
    IssueType.LATENCY_DRIFT: 60,
    IssueType.TUNNEL_DEGRADATION: 30,
    IssueType.MPLS_FAILURE: 15,
    IssueType.BGP_FLAP: 10,
    IssueType.POLICY_DRIFT: 90,
    IssueType.ROUTE_INSTABILITY: 25,
    IssueType.LINK_DOWN: 5,
}


# ──────────────────────────────────────────────────────
# PROPHET TIME-SERIES FORECASTER
# ──────────────────────────────────────────────────────

class ProphetForecaster:
    """
    Uses Facebook Prophet to detect trend anomalies in
    time series telemetry (bandwidth, latency, CPU).
    """

    def __init__(self):
        self._models: Dict[str, any] = {}

    def _get_or_train(self, node_id: str, metric: str, series: pd.DataFrame):
        """Lazily train/retrain Prophet model for a (node, metric) pair."""
        try:
            import sys
            import types
            if "plotly" not in sys.modules:
                sys.modules["plotly"] = types.ModuleType("plotly")
            from prophet import Prophet
        except ImportError:
            logger.warning("Prophet not installed, using fallback")
            return None

        key = f"{node_id}:{metric}"
        if len(series) < 10:
            return None

        try:
            model = Prophet(
                changepoint_prior_scale=0.05,
                seasonality_mode="multiplicative",
                daily_seasonality=True,
                weekly_seasonality=False,
            )
        except Exception as e:
            logger.warning("Prophet initialization failed (e.g. missing Stan backend), using fallback", error=str(e))
            return None

        df = series.rename(columns={"timestamp": "ds", metric: "y"})
        df["ds"] = pd.to_datetime(df["ds"])
        try:
            model.fit(df)
            self._models[key] = model
            return model
        except Exception as e:
            logger.error("Prophet fit failed", error=str(e))
            return None

    def forecast(self, node_id: str, metric: str, series: pd.DataFrame,
                 horizon_minutes: int = 60) -> Optional[Dict]:
        """Return forecast + anomaly flag for next horizon_minutes."""
        model = self._get_or_train(node_id, metric, series)
        if model is None:
            # Fallback: linear extrapolation
            return self._linear_forecast(series, metric, horizon_minutes)

        future = model.make_future_dataframe(periods=horizon_minutes, freq="T")
        forecast = model.predict(future)
        last_actual = series[metric].iloc[-1] if not series.empty else 0.0
        last_forecast = forecast["yhat"].iloc[-1]
        upper = forecast["yhat_upper"].iloc[-1]
        is_anomalous = last_actual > upper * 1.1

        return {
            "current": last_actual,
            "forecast_at_horizon": last_forecast,
            "upper_bound": upper,
            "is_anomalous": is_anomalous,
            "trend": "increasing" if last_forecast > last_actual else "decreasing",
        }

    def _linear_forecast(self, series: pd.DataFrame, metric: str,
                         horizon_minutes: int) -> Dict:
        """Simple linear extrapolation fallback."""
        if series.empty:
            return {"current": 0.0, "forecast_at_horizon": 0.0, "is_anomalous": False, "trend": "stable"}
        vals = series[metric].dropna().values
        if len(vals) < 2:
            return {"current": float(vals[-1]) if len(vals) else 0.0,
                    "forecast_at_horizon": float(vals[-1]) if len(vals) else 0.0,
                    "is_anomalous": False, "trend": "stable"}
        slope = (vals[-1] - vals[0]) / max(len(vals), 1)
        forecast = vals[-1] + slope * horizon_minutes
        return {
            "current": float(vals[-1]),
            "forecast_at_horizon": float(forecast),
            "is_anomalous": forecast > vals[-1] * 1.3,
            "trend": "increasing" if slope > 0.01 else ("decreasing" if slope < -0.01 else "stable"),
        }


# ──────────────────────────────────────────────────────
# ISOLATION FOREST ANOMALY DETECTOR
# ──────────────────────────────────────────────────────

class AnomalyDetector:
    """
    Isolation Forest for multivariate anomaly detection.
    Trained on rolling telemetry window per node.
    """

    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self._models: Dict[str, IsolationForest] = {}
        self._scalers: Dict[str, StandardScaler] = {}

    def train(self, node_id: str, data: pd.DataFrame) -> bool:
        """Train IsolationForest on node telemetry history."""
        features = [f for f in TELEMETRY_FEATURES if f in data.columns]
        if len(features) < 2 or len(data) < 20:
            return False
        X = data[features].fillna(0).values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        model = IsolationForest(
            contamination=self.contamination,
            n_estimators=100,
            random_state=42,
        )
        model.fit(X_scaled)
        self._models[node_id] = model
        self._scalers[node_id] = scaler
        return True

    def detect(self, node_id: str, current_metrics: Dict) -> Dict:
        """Return anomaly score for current metrics snapshot."""
        if node_id not in self._models:
            return {"is_anomaly": False, "anomaly_score": 0.0, "anomalous_features": []}

        features = [f for f in TELEMETRY_FEATURES if f in current_metrics]
        X = np.array([[current_metrics.get(f, 0.0) for f in TELEMETRY_FEATURES]])
        scaler = self._scalers[node_id]
        try:
            X_scaled = scaler.transform(X)
            model = self._models[node_id]
            score = model.score_samples(X_scaled)[0]  # More negative = more anomalous
            prediction = model.predict(X_scaled)[0]  # -1 = anomaly, 1 = normal
            normalized_score = max(0.0, min(100.0, (-score + 0.5) * 100))
            anomalous_features = [
                f for f in features
                if current_metrics.get(f, 0) > self._get_threshold(f)
            ]
            return {
                "is_anomaly": prediction == -1,
                "anomaly_score": normalized_score,
                "anomalous_features": anomalous_features,
                "raw_score": float(score),
            }
        except Exception as e:
            logger.error("Anomaly detection failed", error=str(e))
            return {"is_anomaly": False, "anomaly_score": 0.0, "anomalous_features": []}

    @staticmethod
    def _get_threshold(feature: str) -> float:
        thresholds = {
            "cpu_utilization": 80.0, "memory_utilization": 85.0,
            "bandwidth_utilization": 80.0, "packet_loss": 2.0,
            "latency_ms": 50.0, "jitter_ms": 10.0,
            "error_rate": 1.0, "qos_drop_rate": 5.0,
        }
        return thresholds.get(feature, 100.0)


# ──────────────────────────────────────────────────────
# XGBOOST FAILURE CLASSIFIER
# ──────────────────────────────────────────────────────

class FailureClassifier:
    """
    XGBoost multi-class classifier.
    Predicts: issue_type, confidence_score from feature vector.
    """

    ISSUE_LABELS = [t.value for t in IssueType]
    LABEL_TO_IDX = {v: i for i, v in enumerate(ISSUE_LABELS)}
    IDX_TO_LABEL = {i: v for i, v in enumerate(ISSUE_LABELS)}

    def __init__(self):
        self._model: Optional[xgb.XGBClassifier] = None
        self._is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> bool:
        """Train XGBoost on labeled feature vectors."""
        try:
            self._model = xgb.XGBClassifier(
                max_depth=6,
                learning_rate=0.1,
                n_estimators=200,
                use_label_encoder=False,
                eval_metric="mlogloss",
                random_state=42,
                n_jobs=-1,
            )
            self._model.fit(X, y)
            self._is_trained = True
            logger.info("XGBoost trained", samples=len(X))
            return True
        except Exception as e:
            logger.error("XGBoost training failed", error=str(e))
            return False

    def predict(self, features: Dict) -> Tuple[str, float]:
        """Predict issue type and confidence from feature dict."""
        if not self._is_trained or self._model is None:
            return self._rule_based_classify(features)

        X = np.array([[features.get(f, 0.0) for f in TELEMETRY_FEATURES]])
        proba = self._model.predict_proba(X)[0]
        class_idx = int(np.argmax(proba))
        confidence = float(proba[class_idx])
        return self.IDX_TO_LABEL[class_idx], confidence

    @staticmethod
    def _rule_based_classify(features: Dict) -> Tuple[str, float]:
        """Rule-based fallback when model not trained."""
        bw = features.get("bandwidth_utilization", 0)
        cpu = features.get("cpu_utilization", 0)
        latency = features.get("latency_ms", 0)
        loss = features.get("packet_loss", 0)
        error = features.get("error_rate", 0)
        qos = features.get("qos_drop_rate", 0)

        scores = {
            IssueType.CONGESTION.value:         max(bw / 100, cpu / 100) * 0.9,
            IssueType.LATENCY_DRIFT.value:      latency / 100 * 0.8,
            IssueType.TUNNEL_DEGRADATION.value: loss / 10 * 0.85,
            IssueType.MPLS_FAILURE.value:       (loss / 10 + error / 5) * 0.7,
            IssueType.BGP_FLAP.value:           error / 5 * 0.75,
            IssueType.POLICY_DRIFT.value:       qos / 20 * 0.65,
            IssueType.ROUTE_INSTABILITY.value:  (error / 5 + latency / 100) * 0.6,
        }
        best = max(scores, key=scores.get)
        return best, min(scores[best], 0.95)


# ──────────────────────────────────────────────────────
# ENSEMBLE PREDICTOR
# ──────────────────────────────────────────────────────

class EnsemblePredictor:
    """
    Master predictor combining Prophet + IsolationForest + XGBoost.
    Produces final Prediction object with all required fields.
    """

    def __init__(self):
        self.prophet = ProphetForecaster()
        self.anomaly_detector = AnomalyDetector()
        self.classifier = FailureClassifier()
        self._telemetry_cache: Dict[str, List[Dict]] = {}

    def ingest_telemetry(self, node_id: str, metrics: Dict):
        """Store telemetry for a node (used for time-series models)."""
        if node_id not in self._telemetry_cache:
            self._telemetry_cache[node_id] = []
        entry = {"timestamp": datetime.utcnow(), **metrics}
        self._telemetry_cache[node_id].append(entry)
        # Keep last 2h of data
        cutoff = datetime.utcnow() - timedelta(hours=2)
        self._telemetry_cache[node_id] = [
            e for e in self._telemetry_cache[node_id]
            if e["timestamp"] > cutoff
        ]
        # Auto-train anomaly detector when enough data
        if len(self._telemetry_cache[node_id]) >= 30:
            df = pd.DataFrame(self._telemetry_cache[node_id])
            self.anomaly_detector.train(node_id, df)

    def predict(self, node_id: str, current_metrics: Dict,
                affected_scope: List[str]) -> Optional[Prediction]:
        """Generate a full Prediction for a node given current metrics."""

        # 1. Anomaly detection
        anomaly = self.anomaly_detector.detect(node_id, current_metrics)

        # 2. Time-series forecast for key metrics
        series_df = pd.DataFrame(self._telemetry_cache.get(node_id, []))
        prophet_result = None
        if not series_df.empty and "bandwidth_utilization" in series_df.columns:
            prophet_result = self.prophet.forecast(
                node_id, "bandwidth_utilization", series_df
            )

        # 3. XGBoost classification
        issue_type_str, classifier_confidence = self.classifier.predict(current_metrics)

        # 4. Compute composite risk score
        risk_score = self._compute_risk(
            current_metrics, anomaly, prophet_result, classifier_confidence
        )

        # 5. Only surface predictions above threshold
        if risk_score < 15.0:
            return None

        # 6. Build time-to-impact
        issue_type = IssueType(issue_type_str)
        base_tti = TIME_TO_IMPACT_MAP.get(issue_type, 45)
        # Adjust by risk (higher risk = sooner impact)
        time_to_impact = base_tti * (1 - risk_score / 200)

        # 7. Composite confidence
        confidence = min(0.95, (
            classifier_confidence * 0.5 +
            anomaly.get("anomaly_score", 0) / 200 +
            (0.2 if prophet_result and prophet_result.get("is_anomalous") else 0)
        ))

        return Prediction(
            prediction_id=str(uuid4()),
            node_id=node_id,
            issue_type=issue_type,
            confidence_score=round(confidence, 3),
            risk_score=round(risk_score, 1),
            time_to_impact_minutes=round(time_to_impact, 1),
            affected_scope=affected_scope,
            model_source="ensemble:prophet+iforest+xgboost",
            features_used={k: round(float(v), 3) for k, v in current_metrics.items()
                           if k in TELEMETRY_FEATURES},
            timestamp=datetime.utcnow(),
            explanation=self._build_explanation(
                node_id, issue_type, current_metrics, anomaly, risk_score
            ),
        )

    def _compute_risk(self, metrics: Dict, anomaly: Dict,
                      prophet: Optional[Dict], classifier_conf: float) -> float:
        """Weighted composite risk score 0–100."""
        score = 0.0

        # Metric-based scoring (40%)
        bw   = metrics.get("bandwidth_utilization", 0)
        cpu  = metrics.get("cpu_utilization", 0)
        loss = metrics.get("packet_loss", 0)
        lat  = metrics.get("latency_ms", 0)
        err  = metrics.get("error_rate", 0)

        metric_score = (
            min(bw / 100, 1.0) * 15 +
            min(cpu / 100, 1.0) * 10 +
            min(loss / 10, 1.0) * 10 +
            min(lat / 100, 1.0) * 5
        ) * 2.5  # → max 100, weight 40

        # Anomaly score (30%)
        anomaly_contribution = anomaly.get("anomaly_score", 0) * 0.3

        # Prophet trend (20%)
        prophet_contribution = 0.0
        if prophet and prophet.get("is_anomalous"):
            forecast_ratio = prophet.get("forecast_at_horizon", 0) / max(prophet.get("current", 1), 1)
            prophet_contribution = min(forecast_ratio * 10, 20)

        # Classifier confidence (10%)
        classifier_contribution = classifier_conf * 10

        score = metric_score + anomaly_contribution + prophet_contribution + classifier_contribution
        return round(min(score, 100.0), 2)

    @staticmethod
    def _build_explanation(node_id: str, issue_type: IssueType,
                           metrics: Dict, anomaly: Dict, risk: float) -> str:
        anomalous = ", ".join(anomaly.get("anomalous_features", [])) or "multiple metrics"
        return (
            f"Node {node_id} shows elevated risk (score: {risk:.1f}/100) "
            f"consistent with {issue_type.value.replace('_', ' ').lower()}. "
            f"Anomalous metrics: {anomalous}. "
            f"Bandwidth at {metrics.get('bandwidth_utilization', 0):.1f}%, "
            f"latency {metrics.get('latency_ms', 0):.1f}ms, "
            f"packet loss {metrics.get('packet_loss', 0):.2f}%."
        )


# Singleton
_predictor: Optional[EnsemblePredictor] = None


def get_predictor() -> EnsemblePredictor:
    global _predictor
    if _predictor is None:
        _predictor = EnsemblePredictor()
    return _predictor
