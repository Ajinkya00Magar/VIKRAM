"""
PS13 — Counterfactual Simulation Engine
"What happens if we do nothing? Reroute? Restart tunnel?"
Simulates outcomes of corrective actions on the digital twin.
"""
from datetime import datetime
from typing import Dict, List, Optional, Any
import random
import structlog

from models.schemas import (
    SimulationResult, SimulationAction, SimulationOutcome,
    ActionType, IssueType
)

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# ACTION OUTCOME MODELS
# Defines expected risk reduction, recovery time, side effects
# for each (action_type × issue_type) combination
# ──────────────────────────────────────────────────────

ACTION_EFFICACY: Dict[ActionType, Dict[IssueType, Dict]] = {
    ActionType.REROUTE_TRAFFIC: {
        IssueType.CONGESTION:         {"reduction": 0.65, "recovery": 8,  "cost": 0.2, "side": ["transient packet loss during reroute (~500ms)"]},
        IssueType.MPLS_FAILURE:       {"reduction": 0.75, "recovery": 5,  "cost": 0.3, "side": ["increased path latency +10ms"]},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.55, "recovery": 10, "cost": 0.2, "side": ["suboptimal routing until convergence"]},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.50, "recovery": 12, "cost": 0.2, "side": ["tunnel asymmetry"]},
        IssueType.BGP_FLAP:           {"reduction": 0.40, "recovery": 20, "cost": 0.3, "side": ["BGP reconvergence required"]},
        IssueType.POLICY_DRIFT:       {"reduction": 0.20, "recovery": 30, "cost": 0.1, "side": []},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.60, "recovery": 15, "cost": 0.2, "side": ["temporary loss of redundancy"]},
    },
    ActionType.RESTART_TUNNEL: {
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.90, "recovery": 3,  "cost": 0.5, "side": ["30–60s service interruption on tunnel"]},
        IssueType.CONGESTION:         {"reduction": 0.30, "recovery": 20, "cost": 0.5, "side": ["service break on affected tunnel"]},
        IssueType.MPLS_FAILURE:       {"reduction": 0.50, "recovery": 10, "cost": 0.5, "side": ["full tunnel reset required"]},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.70, "recovery": 5,  "cost": 0.5, "side": ["brief interruption"]},
        IssueType.BGP_FLAP:           {"reduction": 0.35, "recovery": 25, "cost": 0.4, "side": ["BGP session reset"]},
        IssueType.POLICY_DRIFT:       {"reduction": 0.40, "recovery": 10, "cost": 0.4, "side": []},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.55, "recovery": 8,  "cost": 0.4, "side": ["brief routing gap"]},
    },
    ActionType.CLEAR_BGP_SESSION: {
        IssueType.BGP_FLAP:           {"reduction": 0.85, "recovery": 5,  "cost": 0.6, "side": ["BGP route withdraw during clear", "convergence time ~60s"]},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.80, "recovery": 8,  "cost": 0.6, "side": ["routing blackhole during convergence"]},
        IssueType.MPLS_FAILURE:       {"reduction": 0.45, "recovery": 15, "cost": 0.5, "side": ["label stack rebuild required"]},
        IssueType.CONGESTION:         {"reduction": 0.15, "recovery": 40, "cost": 0.3, "side": []},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.30, "recovery": 20, "cost": 0.4, "side": []},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.25, "recovery": 25, "cost": 0.3, "side": []},
        IssueType.POLICY_DRIFT:       {"reduction": 0.10, "recovery": 60, "cost": 0.2, "side": []},
    },
    ActionType.APPLY_RATE_LIMIT: {
        IssueType.CONGESTION:         {"reduction": 0.70, "recovery": 2,  "cost": 0.1, "side": ["reduced throughput for non-priority traffic"]},
        IssueType.POLICY_DRIFT:       {"reduction": 0.60, "recovery": 3,  "cost": 0.1, "side": ["QoS policy enforcement impact"]},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.45, "recovery": 5,  "cost": 0.1, "side": []},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.30, "recovery": 15, "cost": 0.1, "side": []},
        IssueType.BGP_FLAP:           {"reduction": 0.10, "recovery": 60, "cost": 0.1, "side": []},
        IssueType.MPLS_FAILURE:       {"reduction": 0.15, "recovery": 40, "cost": 0.1, "side": []},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.20, "recovery": 30, "cost": 0.1, "side": []},
    },
    ActionType.FAILOVER_TO_BACKUP: {
        IssueType.MPLS_FAILURE:       {"reduction": 0.92, "recovery": 8,  "cost": 0.7, "side": ["increased latency on backup path", "reduced bandwidth"]},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.88, "recovery": 6,  "cost": 0.7, "side": ["failover path asymmetry"]},
        IssueType.CONGESTION:         {"reduction": 0.75, "recovery": 5,  "cost": 0.7, "side": ["backup path may also congest"]},
        IssueType.BGP_FLAP:           {"reduction": 0.65, "recovery": 12, "cost": 0.7, "side": ["BGP reconvergence on backup"]},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.60, "recovery": 10, "cost": 0.6, "side": []},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.80, "recovery": 7,  "cost": 0.7, "side": []},
        IssueType.POLICY_DRIFT:       {"reduction": 0.30, "recovery": 20, "cost": 0.5, "side": []},
    },
    ActionType.RESET_MPLS_PATH: {
        IssueType.MPLS_FAILURE:       {"reduction": 0.95, "recovery": 10, "cost": 0.8, "side": ["full MPLS label stack reset", "15–30s disruption"]},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.70, "recovery": 12, "cost": 0.7, "side": ["OSPF reconvergence required"]},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.55, "recovery": 15, "cost": 0.7, "side": []},
        IssueType.CONGESTION:         {"reduction": 0.40, "recovery": 20, "cost": 0.6, "side": []},
        IssueType.BGP_FLAP:           {"reduction": 0.50, "recovery": 18, "cost": 0.7, "side": []},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.45, "recovery": 15, "cost": 0.6, "side": []},
        IssueType.POLICY_DRIFT:       {"reduction": 0.20, "recovery": 25, "cost": 0.5, "side": []},
    },
    ActionType.INCREASE_QOS_PRIORITY: {
        IssueType.POLICY_DRIFT:       {"reduction": 0.80, "recovery": 1,  "cost": 0.1, "side": ["lower-priority traffic deprioritized"]},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.65, "recovery": 2,  "cost": 0.1, "side": []},
        IssueType.CONGESTION:         {"reduction": 0.50, "recovery": 3,  "cost": 0.1, "side": ["non-QoS traffic affected"]},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.35, "recovery": 8,  "cost": 0.1, "side": []},
        IssueType.MPLS_FAILURE:       {"reduction": 0.20, "recovery": 25, "cost": 0.1, "side": []},
        IssueType.BGP_FLAP:           {"reduction": 0.15, "recovery": 40, "cost": 0.1, "side": []},
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.30, "recovery": 15, "cost": 0.1, "side": []},
    },
    ActionType.CHANGE_ROUTING_PREFERENCE: {
        IssueType.ROUTE_INSTABILITY:  {"reduction": 0.75, "recovery": 8,  "cost": 0.3, "side": ["routing preference change affects all prefixes"]},
        IssueType.BGP_FLAP:           {"reduction": 0.70, "recovery": 10, "cost": 0.3, "side": ["BGP path selection change"]},
        IssueType.MPLS_FAILURE:       {"reduction": 0.60, "recovery": 12, "cost": 0.3, "side": []},
        IssueType.CONGESTION:         {"reduction": 0.55, "recovery": 10, "cost": 0.2, "side": []},
        IssueType.LATENCY_DRIFT:      {"reduction": 0.50, "recovery": 12, "cost": 0.2, "side": []},
        IssueType.TUNNEL_DEGRADATION: {"reduction": 0.45, "recovery": 15, "cost": 0.2, "side": []},
        IssueType.POLICY_DRIFT:       {"reduction": 0.25, "recovery": 20, "cost": 0.2, "side": []},
    },
    ActionType.DO_NOTHING: {t: {"reduction": -0.1, "recovery": 999, "cost": 0.0, "side": ["risk will escalate"]} for t in IssueType},
}


class CounterfactualEngine:
    """
    Simulates: "What happens if we take action X?"
    For each action, computes projected risk, recovery time,
    side effects, and confidence.
    """

    CANDIDATE_ACTIONS = [
        ActionType.REROUTE_TRAFFIC,
        ActionType.RESTART_TUNNEL,
        ActionType.CLEAR_BGP_SESSION,
        ActionType.APPLY_RATE_LIMIT,
        ActionType.FAILOVER_TO_BACKUP,
        ActionType.RESET_MPLS_PATH,
        ActionType.INCREASE_QOS_PRIORITY,
        ActionType.CHANGE_ROUTING_PREFERENCE,
        ActionType.DO_NOTHING,
    ]

    def simulate(
        self,
        trigger_node: str,
        failure_type: IssueType,
        current_risk: float,
        specific_actions: Optional[List[SimulationAction]] = None,
    ) -> SimulationResult:
        """Run counterfactual simulation for all or specified actions."""

        actions_to_test = specific_actions or [
            SimulationAction(action_type=a, target_node=trigger_node)
            for a in self.CANDIDATE_ACTIONS
        ]

        outcomes = []
        for action in actions_to_test:
            outcome = self._simulate_action(action, failure_type, current_risk)
            outcomes.append(outcome)

        # Separate do-nothing outcome
        do_nothing = next(
            (o for o in outcomes if o.action.action_type == ActionType.DO_NOTHING),
            self._simulate_action(
                SimulationAction(action_type=ActionType.DO_NOTHING, target_node=trigger_node),
                failure_type, current_risk
            )
        )
        action_outcomes = [o for o in outcomes if o.action.action_type != ActionType.DO_NOTHING]

        # Best action = highest risk reduction
        best = max(action_outcomes, key=lambda x: x.risk_reduction_pct, default=do_nothing)

        return SimulationResult(
            trigger_node=trigger_node,
            failure_type=failure_type,
            current_risk=current_risk,
            do_nothing_outcome=do_nothing,
            action_outcomes=action_outcomes,
            recommended_action=best.action,
            future_state_projection=self._project_future(current_risk, failure_type, best),
            simulated_at=datetime.utcnow(),
        )

    def _simulate_action(
        self, action: SimulationAction, failure_type: IssueType, current_risk: float
    ) -> SimulationOutcome:
        """Compute projected outcome for a single action."""
        action_type = action.action_type
        efficacy_map = ACTION_EFFICACY.get(action_type, {})
        params = efficacy_map.get(failure_type, {"reduction": 0.1, "recovery": 60, "cost": 0.3, "side": []})

        reduction_pct = max(0.0, min(params["reduction"] * 100, 99.0))
        projected_risk = max(0.0, current_risk * (1 - params["reduction"]))
        recovery_min = params["recovery"]
        side_effects = params.get("side", [])

        # Confidence varies by how well matched action → failure_type
        confidence = self._compute_confidence(action_type, failure_type)

        # Add slight stochasticity (real network has variance)
        noise = random.gauss(0, 2.5)
        projected_risk = max(0.0, min(projected_risk + noise, 100.0))

        cost_map = {0.0: "LOW", 0.1: "LOW", 0.2: "LOW", 0.3: "MEDIUM",
                    0.4: "MEDIUM", 0.5: "MEDIUM", 0.6: "HIGH", 0.7: "HIGH", 0.8: "HIGH"}
        cost_key = min(cost_map.keys(), key=lambda k: abs(k - params["cost"]))
        cost_label = cost_map[cost_key]

        description = self._describe_action(action_type, failure_type, reduction_pct, recovery_min)

        return SimulationOutcome(
            action=action,
            projected_risk=round(projected_risk, 2),
            risk_reduction_pct=round(reduction_pct, 1),
            estimated_recovery_minutes=float(recovery_min),
            side_effects=side_effects,
            confidence=round(confidence, 2),
            description=description,
        )

    def _project_future(self, current_risk: float, failure_type: IssueType,
                        best_action: SimulationOutcome) -> Dict[str, Any]:
        """Project 60-minute future state under best action vs do-nothing."""
        timestamps = list(range(0, 65, 5))
        do_nothing_curve = []
        action_curve = []

        for t in timestamps:
            # Do-nothing: risk escalates
            dn = min(current_risk + (t * 0.8), 100.0)
            do_nothing_curve.append(round(dn, 1))
            # Action: risk drops after recovery time
            recovery = best_action.estimated_recovery_minutes
            if t < recovery:
                ac = current_risk - (current_risk - best_action.projected_risk) * (t / max(recovery, 1))
            else:
                ac = max(best_action.projected_risk - (t - recovery) * 0.3, 5.0)
            action_curve.append(round(ac, 1))

        return {
            "timestamps_minutes": timestamps,
            "do_nothing_risk_curve": do_nothing_curve,
            "action_risk_curve": action_curve,
            "best_action_label": best_action.action.action_type.value,
            "sla_breach_threshold": 80.0,
            "time_to_sla_breach_without_action": next(
                (t for t, r in zip(timestamps, do_nothing_curve) if r >= 80), 999
            ),
        }

    @staticmethod
    def _compute_confidence(action: ActionType, issue: IssueType) -> float:
        """High confidence when action directly addresses the root issue."""
        high_match = {
            (ActionType.CLEAR_BGP_SESSION, IssueType.BGP_FLAP),
            (ActionType.RESTART_TUNNEL, IssueType.TUNNEL_DEGRADATION),
            (ActionType.APPLY_RATE_LIMIT, IssueType.CONGESTION),
            (ActionType.RESET_MPLS_PATH, IssueType.MPLS_FAILURE),
            (ActionType.INCREASE_QOS_PRIORITY, IssueType.POLICY_DRIFT),
            (ActionType.FAILOVER_TO_BACKUP, IssueType.MPLS_FAILURE),
            (ActionType.REROUTE_TRAFFIC, IssueType.CONGESTION),
            (ActionType.CHANGE_ROUTING_PREFERENCE, IssueType.ROUTE_INSTABILITY),
        }
        if (action, issue) in high_match:
            return 0.88 + random.uniform(0, 0.08)
        return 0.55 + random.uniform(0, 0.20)

    @staticmethod
    def _describe_action(action: ActionType, issue: IssueType,
                         reduction: float, recovery: float) -> str:
        desc_map = {
            ActionType.REROUTE_TRAFFIC: f"Redirect traffic to alternate path. Expected {reduction:.0f}% risk reduction, recovery in {recovery:.0f} min.",
            ActionType.RESTART_TUNNEL:  f"Force tunnel re-establishment. Clears degraded state. {reduction:.0f}% reduction, {recovery:.0f} min recovery.",
            ActionType.CLEAR_BGP_SESSION: f"Reset BGP peering to force route reconvergence. {reduction:.0f}% reduction.",
            ActionType.APPLY_RATE_LIMIT: f"Apply traffic shaping to prevent saturation. Immediate {reduction:.0f}% improvement.",
            ActionType.FAILOVER_TO_BACKUP: f"Activate backup path/circuit. {reduction:.0f}% risk drop, {recovery:.0f} min to stable.",
            ActionType.RESET_MPLS_PATH: f"Rebuild MPLS label-switched path end-to-end. {reduction:.0f}% improvement in {recovery:.0f} min.",
            ActionType.INCREASE_QOS_PRIORITY: f"Elevate QoS class for critical traffic. Immediate {reduction:.0f}% improvement.",
            ActionType.CHANGE_ROUTING_PREFERENCE: f"Modify metric/preference to prefer stable path. {reduction:.0f}% reduction.",
            ActionType.DO_NOTHING: "Take no action. Risk will continue to escalate toward SLA breach.",
        }
        return desc_map.get(action, f"Action {action.value}: {reduction:.0f}% expected reduction.")


_engine: Optional[CounterfactualEngine] = None


def get_simulation_engine() -> CounterfactualEngine:
    global _engine
    if _engine is None:
        _engine = CounterfactualEngine()
    return _engine
