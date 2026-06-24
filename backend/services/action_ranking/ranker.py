"""
PS13 — Action Ranking Engine
Combines predictions + risk scores + topology + runbooks
to output a ranked, cost-aware action plan.
"""
from datetime import datetime
from typing import List, Optional, Dict
import structlog

from models.schemas import (
    RankedAction, ActionPlan, ActionType, IssueType
)
from services.simulation.counterfactual import ACTION_EFFICACY

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# RUNBOOK REFERENCES
# <<RUNBOOK_DATA_REQUIRED>> — replace with real runbook IDs
# ──────────────────────────────────────────────────────

RUNBOOK_MAP: Dict[ActionType, str] = {
    ActionType.REROUTE_TRAFFIC:           "RB-NET-001: Traffic Rerouting Procedure",
    ActionType.RESTART_TUNNEL:            "RB-NET-002: IPSec/GRE Tunnel Reset",
    ActionType.CLEAR_BGP_SESSION:         "RB-NET-003: BGP Session Clear & Reconvergence",
    ActionType.APPLY_RATE_LIMIT:          "RB-NET-004: QoS Rate Limiting Application",
    ActionType.FAILOVER_TO_BACKUP:        "RB-NET-005: Primary-to-Backup Failover",
    ActionType.RESET_MPLS_PATH:           "RB-NET-006: MPLS LSP Reset Procedure",
    ActionType.INCREASE_QOS_PRIORITY:     "RB-NET-007: QoS Priority Escalation",
    ActionType.CHANGE_ROUTING_PREFERENCE: "RB-NET-008: Routing Preference Modification",
}

ACTION_STEPS: Dict[ActionType, List[str]] = {
    ActionType.REROUTE_TRAFFIC: [
        "1. Identify congested path using 'show ip route' / 'show mpls ldp bindings'",
        "2. Verify alternate path availability and capacity",
        "3. Modify OSPF cost or BGP local-preference to shift traffic",
        "4. Monitor traffic shift via SNMP/NetFlow for 5 minutes",
        "5. Confirm utilization reduction on primary path",
        "6. Document change in change management system",
    ],
    ActionType.RESTART_TUNNEL: [
        "1. Verify tunnel endpoint reachability: 'ping <remote-ip> source <local-if>'",
        "2. Check IKE/IPSec SA state: 'show crypto isakmp sa' / 'show crypto ipsec sa'",
        "3. Clear existing tunnel: 'clear crypto session remote <ip>'",
        "4. Force tunnel re-negotiation: 'debug crypto isakmp' to confirm",
        "5. Validate traffic flow restoration within 60 seconds",
        "6. Disable debug: 'undebug all'",
    ],
    ActionType.CLEAR_BGP_SESSION: [
        "1. Check BGP peer state: 'show bgp summary'",
        "2. Identify flapping peer IP",
        "3. Apply soft-clear to avoid full table withdrawal: 'clear ip bgp <peer> soft'",
        "4. If soft-clear fails: 'clear ip bgp <peer>'",
        "5. Monitor convergence: 'show bgp summary' every 30s",
        "6. Verify prefix count returns to baseline",
    ],
    ActionType.APPLY_RATE_LIMIT: [
        "1. Identify top traffic contributors via NetFlow/IPFIX",
        "2. Apply rate-limit policy on ingress interface",
        "3. 'policy-map RATE-LIMIT' → 'class class-default' → 'police rate <bps>'",
        "4. Apply to interface: 'service-policy input RATE-LIMIT'",
        "5. Monitor queue depth reduction",
        "6. Adjust rate as congestion clears",
    ],
    ActionType.FAILOVER_TO_BACKUP: [
        "1. Confirm backup path is UP: 'show ip route backup'",
        "2. Check backup path capacity vs current load",
        "3. Trigger failover via tracking: 'ip sla' state or manual static route",
        "4. Validate traffic switchover with 'show ip route'",
        "5. Monitor backup path utilization",
        "6. Initiate root cause investigation on primary",
    ],
    ActionType.RESET_MPLS_PATH: [
        "1. Identify affected LSP: 'show mpls ldp bindings' / 'show mpls forwarding-table'",
        "2. Clear LDP session: 'clear mpls ldp neighbor <ip>'",
        "3. Force LDP re-discovery and label re-exchange",
        "4. Verify LSP re-establishment: 'show mpls ldp neighbor'",
        "5. Confirm end-to-end LSP with 'ping mpls ipv4 <prefix>'",
        "6. Validate forwarding plane recovery",
    ],
    ActionType.INCREASE_QOS_PRIORITY: [
        "1. Identify affected traffic class (VoIP / ERP)",
        "2. Update DSCP marking: increase to EF (46) for VoIP, AF31 for ERP",
        "3. Modify existing policy-map: 'class VOIP' → 'priority percent 30'",
        "4. Re-apply policy to all WAN interfaces",
        "5. Verify MOS score improvement for VoIP",
        "6. Confirm ERP response time improvement",
    ],
    ActionType.CHANGE_ROUTING_PREFERENCE: [
        "1. Identify unstable route: 'show ip route <prefix>'",
        "2. Increase OSPF cost on unstable path: 'ip ospf cost 1000'",
        "3. Or adjust BGP local-preference for preferred path",
        "4. Verify route selection shifts to stable path",
        "5. Confirm with 'show ip route' and traceroute",
        "6. Schedule root cause analysis for unstable path",
    ],
}


class ActionRanker:
    """
    Ranks corrective actions by:
    1. Risk reduction %
    2. Recovery time (faster = better)
    3. Operational cost (lower = better)
    4. Confidence in effectiveness
    """

    def rank(
        self,
        trigger_node: str,
        issue_type: IssueType,
        current_risk: float,
        exclude_actions: Optional[List[ActionType]] = None,
    ) -> ActionPlan:
        """Generate a ranked action plan for a given issue."""

        exclude = set(exclude_actions or [ActionType.DO_NOTHING])

        candidates = []
        for action_type, efficacy_by_issue in ACTION_EFFICACY.items():
            if action_type in exclude:
                continue
            params = efficacy_by_issue.get(issue_type)
            if params is None:
                continue

            reduction_pct = max(0, params["reduction"] * 100)
            recovery_min = params["recovery"]
            cost = params["cost"]
            side = params.get("side", [])

            # Composite ranking score
            score = (
                reduction_pct * 0.50 +           # 50% weight on effectiveness
                (1 / max(recovery_min, 1)) * 30 + # 30% weight on speed
                (1 - cost) * 20                   # 20% weight on low cost
            )

            candidates.append({
                "action_type": action_type,
                "score": score,
                "reduction_pct": reduction_pct,
                "recovery_min": recovery_min,
                "cost": cost,
                "side": side,
            })

        # Sort by composite score descending
        candidates.sort(key=lambda x: x["score"], reverse=True)

        ranked = []
        for i, c in enumerate(candidates, start=1):
            action_type = c["action_type"]
            cost_label = "LOW" if c["cost"] <= 0.2 else ("MEDIUM" if c["cost"] <= 0.5 else "HIGH")
            ranked.append(RankedAction(
                rank=i,
                action_type=action_type,
                target_node=trigger_node,
                description=self._describe(action_type, issue_type, c["reduction_pct"], c["recovery_min"]),
                risk_reduction_pct=round(c["reduction_pct"], 1),
                estimated_recovery_minutes=float(c["recovery_min"]),
                operational_cost=cost_label,
                confidence=self._confidence(action_type, issue_type),
                runbook_reference=RUNBOOK_MAP.get(action_type),
                steps=ACTION_STEPS.get(action_type, []),
            ))

        logger.info("Actions ranked", node=trigger_node, issue=issue_type, count=len(ranked))

        return ActionPlan(
            trigger_node=trigger_node,
            issue_type=issue_type,
            ranked_actions=ranked,
            generated_at=datetime.utcnow(),
        )

    @staticmethod
    def _describe(action: ActionType, issue: IssueType,
                  reduction: float, recovery: float) -> str:
        base = action.value.replace("_", " ").title()
        return (
            f"{base} — expected {reduction:.0f}% risk reduction, "
            f"recovery in ~{recovery:.0f} min for {issue.value.replace('_', ' ').lower()}."
        )

    @staticmethod
    def _confidence(action: ActionType, issue: IssueType) -> float:
        high_pairs = {
            (ActionType.CLEAR_BGP_SESSION, IssueType.BGP_FLAP): 0.92,
            (ActionType.RESTART_TUNNEL, IssueType.TUNNEL_DEGRADATION): 0.91,
            (ActionType.APPLY_RATE_LIMIT, IssueType.CONGESTION): 0.89,
            (ActionType.RESET_MPLS_PATH, IssueType.MPLS_FAILURE): 0.94,
            (ActionType.INCREASE_QOS_PRIORITY, IssueType.POLICY_DRIFT): 0.87,
            (ActionType.FAILOVER_TO_BACKUP, IssueType.MPLS_FAILURE): 0.90,
            (ActionType.REROUTE_TRAFFIC, IssueType.CONGESTION): 0.85,
        }
        return high_pairs.get((action, issue), 0.65)


_ranker: Optional[ActionRanker] = None


def get_ranker() -> ActionRanker:
    global _ranker
    if _ranker is None:
        _ranker = ActionRanker()
    return _ranker
