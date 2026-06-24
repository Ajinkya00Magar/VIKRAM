"""
PS13 — Background Orchestrator
Runs the prediction → risk → broadcast cycle continuously.
This is the "brain" loop of the system.
"""
import asyncio
from datetime import datetime
from typing import List, Dict
import structlog

from services.digital_twin.twin import get_twin
from services.prediction.predictor import get_predictor
from services.risk.risk_engine import get_risk_engine
from services.blast_radius.analyzer import get_analyzer
from services.action_ranking.ranker import get_ranker
from core.websocket_manager import (
    broadcast_risk_update, broadcast_prediction, broadcast_alert
)
from models.schemas import IssueType, RiskLevel

logger = structlog.get_logger(__name__)

RISK_CALC_INTERVAL = 10    # seconds
PREDICTION_INTERVAL = 30   # seconds
ALERT_THRESHOLD = 65.0     # risk score that triggers alert


class Orchestrator:
    """
    Continuous background loop that:
    1. Reads current metrics from digital twin
    2. Runs risk engine on all nodes
    3. Runs ensemble predictor when needed
    4. Broadcasts updates via WebSocket
    5. Triggers alerts on threshold breach
    """

    def __init__(self):
        self._running = False
        self._prediction_tick = 0
        self._alerted_nodes: Dict[str, float] = {}   # node_id → last alerted risk

    async def start(self):
        self._running = True
        logger.info("Orchestrator started")
        await asyncio.gather(
            self._risk_loop(),
            self._prediction_loop(),
        )

    def stop(self):
        self._running = False

    async def _risk_loop(self):
        """Compute and broadcast risk scores every RISK_CALC_INTERVAL seconds."""
        while self._running:
            try:
                await self._compute_and_broadcast_risk()
            except Exception as e:
                logger.error("Risk loop error", error=str(e))
            await asyncio.sleep(RISK_CALC_INTERVAL)

    async def _prediction_loop(self):
        """Run predictions every PREDICTION_INTERVAL seconds."""
        await asyncio.sleep(15)  # Initial delay to let telemetry accumulate
        while self._running:
            try:
                await self._run_predictions()
            except Exception as e:
                logger.error("Prediction loop error", error=str(e))
            await asyncio.sleep(PREDICTION_INTERVAL)

    async def _compute_and_broadcast_risk(self):
        twin = get_twin()
        risk_engine = get_risk_engine()

        all_scores = []
        active_predictions = 0

        for node_id in twin.graph.nodes:
            metrics = twin.node_metrics.get(node_id, {})
            is_critical = twin.graph.nodes[node_id].get("is_critical", False)

            score = risk_engine.compute(
                node_id=node_id,
                metrics=metrics,
                is_critical=is_critical,
                active_predictions=0,
            )
            all_scores.append(score)

            # Update risk_score in twin
            metrics["risk_score"] = score.risk_score
            twin.update_node_metrics(node_id, {"risk_score": score.risk_score})

            # Alert if threshold exceeded and not already alerted at this level
            prev_alerted = self._alerted_nodes.get(node_id, 0.0)
            if score.risk_score >= ALERT_THRESHOLD and score.risk_score > prev_alerted + 5:
                self._alerted_nodes[node_id] = score.risk_score
                await broadcast_alert({
                    "node_id": node_id,
                    "risk_score": score.risk_score,
                    "urgency": score.urgency_level.value,
                    "escalation_level": score.escalation_level,
                    "trend": score.trend,
                    "risk_factors": score.risk_factors,
                    "message": f"Risk threshold exceeded on {node_id}: {score.risk_score:.1f}/100 ({score.urgency_level.value})",
                })
            elif score.risk_score < ALERT_THRESHOLD * 0.7:
                # Clear alert state when risk recovers
                self._alerted_nodes.pop(node_id, None)

        summary = risk_engine.compute_system(all_scores, active_predictions)
        await broadcast_risk_update({
            "overall_risk": summary.overall_risk,
            "highest_risk_node": summary.highest_risk_node,
            "active_predictions": summary.active_predictions,
            "critical_nodes": summary.critical_nodes,
            "node_scores": [
                {
                    "node_id": s.node_id,
                    "risk_score": s.risk_score,
                    "urgency_level": s.urgency_level.value,
                    "trend": s.trend,
                    "escalation_level": s.escalation_level,
                }
                for s in all_scores
            ],
            "calculated_at": summary.calculated_at.isoformat(),
        })

    async def _run_predictions(self):
        twin = get_twin()
        predictor = get_predictor()
        predictions_fired = 0

        for node_id in twin.graph.nodes:
            metrics = twin.node_metrics.get(node_id, {})
            if not metrics:
                continue

            affected = list(twin.get_downstream_nodes(node_id, depth=3))
            prediction = predictor.predict(node_id, metrics, affected)

            if prediction and prediction.risk_score >= 30:
                predictions_fired += 1
                await broadcast_prediction({
                    "prediction_id": prediction.prediction_id,
                    "node_id": prediction.node_id,
                    "issue_type": prediction.issue_type.value,
                    "confidence_score": prediction.confidence_score,
                    "risk_score": prediction.risk_score,
                    "time_to_impact_minutes": prediction.time_to_impact_minutes,
                    "affected_scope": prediction.affected_scope,
                    "explanation": prediction.explanation,
                    "timestamp": prediction.timestamp.isoformat(),
                })

        if predictions_fired > 0:
            logger.info("Predictions broadcast", count=predictions_fired)


_orchestrator: Orchestrator = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
