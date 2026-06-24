"""
PS13 — Blast Radius Analysis Engine
"If this node fails, what else breaks?"
BFS/DFS propagation through NetworkX dependency graph.
"""
from datetime import datetime
from typing import List, Optional
import structlog

from models.schemas import BlastRadiusResult, IssueType
from services.digital_twin.twin import get_twin, SITE_USER_COUNT

logger = structlog.get_logger(__name__)


class BlastRadiusAnalyzer:
    """
    Computes the blast radius of a failure at any given node.
    Uses BFS on the digital twin graph to propagate impact.
    """

    def __init__(self):
        pass

    def analyze(self, trigger_node: str,
                failure_type: IssueType) -> BlastRadiusResult:
        """
        Main analysis entry point.

        Returns full blast radius including:
        - affected nodes, sites, services
        - estimated user impact
        - impact score
        - propagation paths
        """
        twin = get_twin()

        # 1. BFS propagation from failure node
        affected_nodes = list(twin.get_downstream_nodes(trigger_node, depth=5))

        # 2. Map to sites and services
        affected_sites = twin.get_affected_sites(set(affected_nodes))
        affected_services = twin.get_affected_services(set(affected_nodes))

        # 3. Also include trigger node's own site
        if trigger_node in twin.graph.nodes:
            trigger_site = twin.graph.nodes[trigger_node].get("site")
            if trigger_site and trigger_site not in affected_sites:
                affected_sites.append(trigger_site)

        # 4. Estimated users
        users_impacted = twin.get_user_count(affected_sites)

        # 5. Impact score (weighted by criticality and breadth)
        impact_score = self._compute_impact_score(
            trigger_node, affected_nodes, affected_services, failure_type, twin
        )

        # 6. Propagation depth
        depth = twin.propagation_depth(trigger_node)

        # 7. Propagation paths (sample paths to key service nodes)
        service_nodes = [
            n for n in twin.graph.nodes
            if twin.graph.nodes[n].get("node_type", "").value
               in ("SERVICE", "SITE") if hasattr(twin.graph.nodes[n].get("node_type", ""), "value")
        ]
        propagation_paths = []
        for sn in service_nodes[:4]:
            path = twin.get_critical_path(trigger_node, sn)
            if path and len(path) > 1:
                propagation_paths.append(path)

        logger.info(
            "Blast radius computed",
            trigger=trigger_node,
            affected_count=len(affected_nodes),
            users=users_impacted,
            impact=impact_score,
        )

        return BlastRadiusResult(
            trigger_node=trigger_node,
            failure_type=failure_type,
            affected_nodes=affected_nodes,
            affected_sites=affected_sites,
            affected_services=affected_services,
            estimated_users_impacted=users_impacted,
            impact_score=round(impact_score, 2),
            propagation_depth=depth,
            propagation_path=propagation_paths,
            calculated_at=datetime.utcnow(),
        )

    def _compute_impact_score(
        self, trigger_node: str, affected_nodes: List[str],
        affected_services: List[str], failure_type: IssueType, twin
    ) -> float:
        """
        Impact score 0–100 based on:
        - Number of affected nodes (breadth)
        - Criticality of trigger
        - Services disrupted (voice > ERP > internet)
        - Failure severity
        """
        total_nodes = twin.graph.number_of_nodes()
        breadth_score = (len(affected_nodes) / max(total_nodes, 1)) * 40

        is_critical = twin.graph.nodes.get(trigger_node, {}).get("is_critical", False)
        criticality_score = 20 if is_critical else 8

        service_weights = {"voip": 25, "erp": 20, "video": 10, "internet": 15,
                           "mpls-core": 30, "sdwan-mgmt": 15}
        service_score = min(sum(service_weights.get(s, 5) for s in affected_services), 35)

        failure_weight = {
            IssueType.MPLS_FAILURE: 1.0,
            IssueType.BGP_FLAP: 0.9,
            IssueType.TUNNEL_DEGRADATION: 0.8,
            IssueType.CONGESTION: 0.6,
            IssueType.LATENCY_DRIFT: 0.5,
            IssueType.POLICY_DRIFT: 0.4,
            IssueType.ROUTE_INSTABILITY: 0.7,
        }.get(failure_type, 0.5)

        raw = (breadth_score + criticality_score + service_score) * failure_weight
        return min(raw, 100.0)


# Singleton
_analyzer: Optional[BlastRadiusAnalyzer] = None


def get_analyzer() -> BlastRadiusAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = BlastRadiusAnalyzer()
    return _analyzer
