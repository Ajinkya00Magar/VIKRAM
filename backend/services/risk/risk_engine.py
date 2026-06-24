"""
PS13 — Risk Scoring Engine
Multi-factor risk engine producing scores 0–100,
severity, escalation level, and urgency for all nodes.
"""
from datetime import datetime
from typing import Dict, List, Optional
import structlog

from models.schemas import (
    RiskScore, SystemRiskSummary, RiskLevel, IssueType
)

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# RISK WEIGHTS (tunable per environment)
# ──────────────────────────────────────────────────────

RISK_WEIGHTS = {
    "bandwidth_utilization": 0.20,
    "cpu_utilization":       0.15,
    "memory_utilization":    0.08,
    "packet_loss":           0.25,
    "latency_ms":            0.12,
    "jitter_ms":             0.05,
    "error_rate":            0.10,
    "qos_drop_rate":         0.05,
}

# Normalizers: value that maps to 100% contribution
NORMALIZERS = {
    "bandwidth_utilization": 100.0,
    "cpu_utilization":       100.0,
    "memory_utilization":    100.0,
    "packet_loss":           10.0,
    "latency_ms":            200.0,
    "jitter_ms":             50.0,
    "error_rate":            10.0,
    "qos_drop_rate":         20.0,
}

# Escalation thresholds
ESCALATION_LEVELS = [
    (0,  20,  0, RiskLevel.HEALTHY),
    (20, 35,  1, RiskLevel.LOW),
    (35, 55,  2, RiskLevel.MEDIUM),
    (55, 75,  3, RiskLevel.HIGH),
    (75, 90,  4, RiskLevel.HIGH),
    (90, 100, 5, RiskLevel.CRITICAL),
]

# Critical-node multiplier (hub routers, PE routers carry higher weight)
CRITICALITY_MULTIPLIER = 1.25


class RiskEngine:
    """
    Computes risk scores for every node in the network.
    Maintains history for trend computation (INCREASING / STABLE / DECREASING).
    """

    def __init__(self):
        self._history: Dict[str, List[float]] = {}   # node_id → last N scores
        self._history_window = 6                      # last 6 readings
        self._last_scores: Dict[str, RiskScore] = {}

    def compute(self, node_id: str, metrics: Dict,
                is_critical: bool = False,
                active_predictions: int = 0) -> RiskScore:
        """
        Compute risk score for a single node.

        Parameters
        ----------
        node_id           : Unique node identifier
        metrics           : Dict of telemetry metric name → float value
        is_critical       : Whether node is a critical network hub
        active_predictions: Number of active ML predictions for this node
        """

        # 1. Weighted metric score
        metric_score = self._metric_score(metrics)

        # 2. Prediction penalty (each active prediction adds up to +10)
        prediction_penalty = min(active_predictions * 8, 25)

        # 3. Raw risk before criticality
        raw_risk = min(metric_score + prediction_penalty, 100.0)

        # 4. Apply criticality multiplier (capped at 100)
        risk = min(raw_risk * (CRITICALITY_MULTIPLIER if is_critical else 1.0), 100.0)
        risk = round(risk, 2)

        # 5. Severity (similar scale but weight on worst single metric)
        severity = self._severity_score(metrics)

        # 6. Escalation level
        escalation, urgency = self._escalation(risk)

        # 7. Trend
        trend = self._compute_trend(node_id, risk)

        # 8. Risk factor breakdown
        risk_factors = {
            k: round(min(metrics.get(k, 0) / NORMALIZERS.get(k, 100) * 100, 100), 2)
            for k in RISK_WEIGHTS
        }

        score = RiskScore(
            node_id=node_id,
            risk_score=risk,
            severity_score=severity,
            escalation_level=escalation,
            urgency_level=urgency,
            risk_factors=risk_factors,
            trend=trend,
            calculated_at=datetime.utcnow(),
        )
        self._last_scores[node_id] = score
        return score

    def compute_system(self, all_node_scores: List[RiskScore],
                       active_predictions: int) -> SystemRiskSummary:
        """Aggregate system-level risk summary."""
        if not all_node_scores:
            return SystemRiskSummary(
                overall_risk=0.0,
                highest_risk_node="N/A",
                active_predictions=0,
                critical_nodes=[],
                risk_scores=[],
                calculated_at=datetime.utcnow(),
            )

        scores = [s.risk_score for s in all_node_scores]
        overall = round(sum(scores) / len(scores), 2)
        highest = max(all_node_scores, key=lambda x: x.risk_score)
        critical = [s.node_id for s in all_node_scores if s.risk_score >= 75]

        return SystemRiskSummary(
            overall_risk=overall,
            highest_risk_node=highest.node_id,
            active_predictions=active_predictions,
            critical_nodes=critical,
            risk_scores=all_node_scores,
            calculated_at=datetime.utcnow(),
        )

    def _metric_score(self, metrics: Dict) -> float:
        """Weighted sum of normalized metric values → 0–100."""
        score = 0.0
        for metric, weight in RISK_WEIGHTS.items():
            val = metrics.get(metric, 0.0)
            normalizer = NORMALIZERS.get(metric, 100.0)
            normalized = min(val / normalizer, 1.0)
            score += normalized * weight
        return round(score * 100, 2)

    def _severity_score(self, metrics: Dict) -> float:
        """Worst-case single metric normalized to 0–100."""
        worst = 0.0
        for metric, normalizer in NORMALIZERS.items():
            val = metrics.get(metric, 0.0)
            normalized = min(val / normalizer * 100, 100.0)
            worst = max(worst, normalized)
        return round(worst, 2)

    def _escalation(self, risk: float):
        for lo, hi, level, urgency in ESCALATION_LEVELS:
            if lo <= risk < hi:
                return level, urgency
        return 5, RiskLevel.CRITICAL

    def _compute_trend(self, node_id: str, current_risk: float) -> str:
        history = self._history.setdefault(node_id, [])
        # Only append if not already the same tick (avoid double-counting)
        history.append(current_risk)
        # Keep last N readings
        while len(history) > self._history_window:
            history.pop(0)
        if len(history) < 3:
            return "STABLE"
        # Compare most recent vs 3 readings ago
        delta = history[-1] - history[max(0, len(history) - 3)]
        if delta > 3:   return "INCREASING"
        if delta < -3:  return "DECREASING"
        return "STABLE"

    def get_last_score(self, node_id: str) -> Optional[RiskScore]:
        return self._last_scores.get(node_id)


# Singleton
_risk_engine: Optional[RiskEngine] = None


def get_risk_engine() -> RiskEngine:
    global _risk_engine
    if _risk_engine is None:
        _risk_engine = RiskEngine()
    return _risk_engine
