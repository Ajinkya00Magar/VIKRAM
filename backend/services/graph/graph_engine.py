"""
PS13 — Graph Intelligence Engine
Advanced NetworkX operations on the digital twin graph.
Dependency mapping, service graphs, path analysis, impact propagation.
"""
import networkx as nx
from typing import Dict, List, Optional, Tuple, Set, Any
from datetime import datetime
import structlog

from services.digital_twin.twin import get_twin

logger = structlog.get_logger(__name__)


class GraphIntelligenceEngine:
    """
    Wraps the digital twin NetworkX graph with advanced analytics:
    - Betweenness centrality (critical transit nodes)
    - Service dependency graphs
    - Redundancy analysis
    - MPLS path analysis
    - Failure propagation modeling
    """

    def get_centrality_ranking(self) -> List[Dict[str, Any]]:
        """
        Betweenness centrality ranking.
        Nodes with high centrality = critical transit points.
        """
        twin = get_twin()
        centrality = nx.betweenness_centrality(twin.graph, normalized=True)
        closeness  = nx.closeness_centrality(twin.graph)

        ranked = []
        for node_id, bc in sorted(centrality.items(), key=lambda x: -x[1]):
            data = twin.graph.nodes.get(node_id, {})
            metrics = twin.node_metrics.get(node_id, {})
            ranked.append({
                "node_id": node_id,
                "label": data.get("label", node_id),
                "node_type": str(data.get("node_type", "")),
                "site": data.get("site"),
                "betweenness_centrality": round(bc, 4),
                "closeness_centrality": round(closeness.get(node_id, 0), 4),
                "is_critical": data.get("is_critical", False),
                "risk_score": metrics.get("risk_score", 0),
                "interpretation": self._interpret_centrality(bc, data.get("is_critical", False)),
            })
        return ranked

    def get_service_dependency_graph(self, service: str) -> Dict[str, Any]:
        """
        Build service dependency graph for a named service (voip, erp, internet, etc.).
        Shows all nodes required to deliver the service.
        """
        twin = get_twin()
        service_nodes = [
            nid for nid, data in twin.graph.nodes(data=True)
            if service in data.get("services", [])
        ]
        if not service_nodes:
            return {"service": service, "nodes": [], "links": [], "risk": 0}

        # Build subgraph
        subgraph = twin.graph.subgraph(service_nodes)
        avg_risk = sum(
            twin.node_metrics.get(n, {}).get("risk_score", 0)
            for n in service_nodes
        ) / max(len(service_nodes), 1)

        return {
            "service": service,
            "nodes": [
                {
                    "node_id": n,
                    "label": twin.graph.nodes[n].get("label", n),
                    "site": twin.graph.nodes[n].get("site"),
                    "risk_score": twin.node_metrics.get(n, {}).get("risk_score", 0),
                }
                for n in service_nodes
            ],
            "links": [
                {"source": u, "target": v}
                for u, v in subgraph.edges()
            ],
            "node_count": len(service_nodes),
            "average_risk": round(avg_risk, 2),
            "single_point_of_failure": self._find_spof(service_nodes, twin.graph),
        }

    def get_redundancy_analysis(self) -> Dict[str, Any]:
        """
        Analyze network redundancy:
        - Single points of failure (no alternate path)
        - Redundant paths between hub and spokes
        - MPLS path redundancy
        """
        twin = get_twin()
        spofs = []
        redundant_paths = {}

        spokes = [n for n in twin.graph.nodes
                  if "SPOKE" in n or "CE" in n]
        hubs   = [n for n in twin.graph.nodes
                  if twin.graph.nodes[n].get("is_critical") and "HUB" in n]

        for spoke in spokes:
            for hub in hubs:
                paths = twin.get_all_paths(spoke, hub)
                count = len(paths)
                key = f"{spoke}→{hub}"
                redundant_paths[key] = {
                    "path_count": count,
                    "redundant": count > 1,
                    "shortest_path": paths[0] if paths else [],
                }
                if count <= 1:
                    spofs.append({"source": spoke, "target": hub,
                                  "path_count": count, "risk": "HIGH"})

        # Edge connectivity
        try:
            edge_conn = nx.edge_connectivity(twin.graph)
        except Exception:
            edge_conn = 0

        try:
            node_conn = nx.node_connectivity(twin.graph)
        except Exception:
            node_conn = 0

        return {
            "edge_connectivity": edge_conn,
            "node_connectivity": node_conn,
            "single_points_of_failure": spofs,
            "redundant_paths": redundant_paths,
            "redundancy_score": round(min(edge_conn * 25, 100), 1),
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }

    def get_mpls_path_analysis(self) -> Dict[str, Any]:
        """
        Analyze MPLS label-switched paths through PE routers.
        Identifies potential LSP congestion and backup paths.
        """
        twin = get_twin()
        mpls_links = [
            (u, v, data)
            for u, v, data in twin.graph.edges(data=True)
            if data.get("is_mpls")
        ]
        pe_nodes = [
            n for n in twin.graph.nodes
            if "PE" in n or twin.graph.nodes[n].get("node_type", "").value == "PE"
               if hasattr(twin.graph.nodes[n].get("node_type", ""), "value")
        ]

        lsps = []
        for link_src, link_dst, link_data in mpls_links:
            if "_REV" not in link_data.get("link_id", ""):
                metrics_src = twin.node_metrics.get(link_src, {})
                lsps.append({
                    "link_id": link_data.get("link_id"),
                    "source": link_src,
                    "target": link_dst,
                    "bandwidth_mbps": link_data.get("bandwidth_mbps"),
                    "utilization": link_data.get("utilization", metrics_src.get("bandwidth_utilization", 0)),
                    "latency_ms": link_data.get("latency_ms", metrics_src.get("latency_ms", 0)),
                    "status": link_data.get("status", "UP"),
                    "risk": "HIGH" if link_data.get("utilization", 0) > 75 else "NORMAL",
                })

        congested_lsps = [l for l in lsps if l["utilization"] > 70]
        return {
            "total_lsps": len(lsps),
            "congested_lsps": len(congested_lsps),
            "lsps": sorted(lsps, key=lambda x: -x["utilization"]),
            "pe_nodes": pe_nodes,
            "overall_mpls_health": "DEGRADED" if congested_lsps else "HEALTHY",
        }

    def get_impact_propagation_model(self, trigger_node: str) -> Dict[str, Any]:
        """
        Model failure propagation wave from trigger node.
        Returns propagation by hop distance (wave 1, wave 2, wave 3...).
        """
        twin = get_twin()
        if trigger_node not in twin.graph:
            return {"error": f"Node {trigger_node} not found"}

        waves = {}
        try:
            lengths = nx.single_source_shortest_path_length(twin.graph, trigger_node)
            for node, dist in lengths.items():
                if node == trigger_node:
                    continue
                if dist not in waves:
                    waves[dist] = []
                node_data = twin.graph.nodes.get(node, {})
                waves[dist].append({
                    "node_id": node,
                    "site": node_data.get("site"),
                    "is_critical": node_data.get("is_critical", False),
                    "services": node_data.get("services", []),
                    "risk_score": twin.node_metrics.get(node, {}).get("risk_score", 0),
                })
        except Exception as e:
            logger.error("Propagation model failed", error=str(e))

        return {
            "trigger_node": trigger_node,
            "propagation_waves": {
                f"hop_{k}": v for k, v in sorted(waves.items())
            },
            "max_depth": max(waves.keys()) if waves else 0,
            "total_affected": sum(len(v) for v in waves.values()),
        }

    def get_critical_infrastructure_nodes(self) -> List[Dict[str, Any]]:
        """
        Return nodes that are both high-centrality AND high-risk.
        These are the most dangerous nodes in the network.
        """
        twin = get_twin()
        centrality = nx.betweenness_centrality(twin.graph, normalized=True)
        critical = []
        for node_id, bc in centrality.items():
            risk = twin.node_metrics.get(node_id, {}).get("risk_score", 0)
            is_crit = twin.graph.nodes[node_id].get("is_critical", False)
            if bc > 0.1 or is_crit:
                critical.append({
                    "node_id": node_id,
                    "centrality": round(bc, 4),
                    "risk_score": round(risk, 1),
                    "combined_score": round(bc * 50 + risk * 0.5, 1),
                    "is_critical": is_crit,
                    "site": twin.graph.nodes[node_id].get("site"),
                })
        return sorted(critical, key=lambda x: -x["combined_score"])

    @staticmethod
    def _find_spof(nodes: List[str], graph: nx.DiGraph) -> List[str]:
        """Nodes with no alternate path (single points of failure)."""
        spofs = []
        for node in nodes:
            predecessors = list(graph.predecessors(node))
            if len(predecessors) <= 1 and node not in [n for n in nodes if "PE" in n]:
                spofs.append(node)
        return spofs

    @staticmethod
    def _interpret_centrality(bc: float, is_critical: bool) -> str:
        if bc > 0.3:   return "CRITICAL TRANSIT — failure here disrupts most paths"
        if bc > 0.15:  return "HIGH IMPACT — key routing hub"
        if bc > 0.05:  return "MEDIUM IMPACT — significant transit role"
        if is_critical: return "CRITICAL (infrastructure) — low transit but business critical"
        return "LOW IMPACT — peripheral node"


_engine: Optional[GraphIntelligenceEngine] = None


def get_graph_engine() -> GraphIntelligenceEngine:
    global _engine
    if _engine is None:
        _engine = GraphIntelligenceEngine()
    return _engine
