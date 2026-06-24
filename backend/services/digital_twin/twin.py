"""
PS13 — Network Digital Twin
A live, in-memory NetworkX graph that mirrors the real MPLS network topology.
Supports: dependency mapping, path analysis, impact propagation.
"""
import networkx as nx
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
import structlog
import json

from models.schemas import (
    TopologyNode, TopologyLink, NetworkTopology,
    NodeType, LinkType, RiskLevel
)

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# SAMPLE MPLS ENTERPRISE TOPOLOGY
# <<NETWORK_TOPOLOGY_CONFIGURATION_REQUIRED>> for production
# Replace with actual device inventory from CMDB
# ──────────────────────────────────────────────────────

SAMPLE_TOPOLOGY_NODES = [
    {"node_id": "HUB-RTR-01",  "label": "Hub Router 01",    "type": NodeType.ROUTER,    "site": "HQ",      "ip": "10.0.0.1",  "x": 500, "y": 300, "critical": True,  "services": ["voip", "erp", "internet"]},
    {"node_id": "MPLS-PE-01",  "label": "MPLS PE Router 01","type": NodeType.PE,        "site": "DC1",     "ip": "10.0.1.1",  "x": 300, "y": 150, "critical": True,  "services": ["mpls-core"]},
    {"node_id": "MPLS-PE-02",  "label": "MPLS PE Router 02","type": NodeType.PE,        "site": "DC2",     "ip": "10.0.1.2",  "x": 700, "y": 150, "critical": True,  "services": ["mpls-core"]},
    {"node_id": "SDWAN-CTRL",  "label": "SD-WAN Controller","type": NodeType.SDWAN_CTRL,"site": "HQ",      "ip": "10.0.0.10", "x": 500, "y": 100, "critical": True,  "services": ["sdwan-mgmt"]},
    {"node_id": "SPOKE-RTR-A", "label": "Spoke Router A",   "type": NodeType.ROUTER,    "site": "SITE-A",  "ip": "10.1.0.1",  "x": 150, "y": 450, "critical": False, "services": ["voip", "erp"]},
    {"node_id": "SPOKE-RTR-B", "label": "Spoke Router B",   "type": NodeType.ROUTER,    "site": "SITE-B",  "ip": "10.2.0.1",  "x": 350, "y": 500, "critical": False, "services": ["erp", "internet"]},
    {"node_id": "SPOKE-RTR-C", "label": "Spoke Router C",   "type": NodeType.ROUTER,    "site": "SITE-C",  "ip": "10.3.0.1",  "x": 650, "y": 500, "critical": False, "services": ["voip", "video"]},
    {"node_id": "SPOKE-RTR-D", "label": "Spoke Router D",   "type": NodeType.ROUTER,    "site": "SITE-D",  "ip": "10.4.0.1",  "x": 850, "y": 450, "critical": False, "services": ["internet"]},
    {"node_id": "BGP-PEER-01", "label": "BGP Internet Peer","type": NodeType.ROUTER,    "site": "TRANSIT", "ip": "203.0.1.1", "x": 500, "y": 30,  "critical": True,  "services": ["internet"]},
    {"node_id": "SVC-VOIP",    "label": "VoIP Service",     "type": NodeType.SERVICE,   "site": "HQ",      "ip": "10.0.5.1",  "x": 350, "y": 350, "critical": True,  "services": ["voip"]},
    {"node_id": "SVC-ERP",     "label": "ERP Service",      "type": NodeType.SERVICE,   "site": "HQ",      "ip": "10.0.5.2",  "x": 500, "y": 380, "critical": True,  "services": ["erp"]},
    {"node_id": "SVC-VIDEO",   "label": "Video Service",    "type": NodeType.SERVICE,   "site": "HQ",      "ip": "10.0.5.3",  "x": 650, "y": 350, "critical": False, "services": ["video"]},
]

SAMPLE_TOPOLOGY_LINKS = [
    {"link_id": "L01", "src": "HUB-RTR-01",  "dst": "MPLS-PE-01",  "type": LinkType.MPLS,    "bw": 1000, "mpls": True},
    {"link_id": "L02", "src": "HUB-RTR-01",  "dst": "MPLS-PE-02",  "type": LinkType.MPLS,    "bw": 1000, "mpls": True},
    {"link_id": "L03", "src": "MPLS-PE-01",  "dst": "MPLS-PE-02",  "type": LinkType.MPLS,    "bw": 10000,"mpls": True},
    {"link_id": "L04", "src": "MPLS-PE-01",  "dst": "BGP-PEER-01", "type": LinkType.BGP,     "bw": 1000, "mpls": False},
    {"link_id": "L05", "src": "HUB-RTR-01",  "dst": "SDWAN-CTRL",  "type": LinkType.SDWAN,   "bw": 100,  "mpls": False},
    {"link_id": "L06", "src": "SPOKE-RTR-A", "dst": "HUB-RTR-01",  "type": LinkType.IPSEC,   "bw": 100,  "mpls": False,  "tunnel": "TUN-A-HUB"},
    {"link_id": "L07", "src": "SPOKE-RTR-A", "dst": "MPLS-PE-01",  "type": LinkType.MPLS,    "bw": 100,  "mpls": True},
    {"link_id": "L08", "src": "SPOKE-RTR-B", "dst": "HUB-RTR-01",  "type": LinkType.IPSEC,   "bw": 200,  "mpls": False,  "tunnel": "TUN-B-HUB"},
    {"link_id": "L09", "src": "SPOKE-RTR-B", "dst": "MPLS-PE-01",  "type": LinkType.MPLS,    "bw": 200,  "mpls": True},
    {"link_id": "L10", "src": "SPOKE-RTR-C", "dst": "HUB-RTR-01",  "type": LinkType.IPSEC,   "bw": 200,  "mpls": False,  "tunnel": "TUN-C-HUB"},
    {"link_id": "L11", "src": "SPOKE-RTR-C", "dst": "MPLS-PE-02",  "type": LinkType.MPLS,    "bw": 200,  "mpls": True},
    {"link_id": "L12", "src": "SPOKE-RTR-D", "dst": "HUB-RTR-01",  "type": LinkType.IPSEC,   "bw": 100,  "mpls": False,  "tunnel": "TUN-D-HUB"},
    {"link_id": "L13", "src": "SPOKE-RTR-D", "dst": "MPLS-PE-02",  "type": LinkType.MPLS,    "bw": 100,  "mpls": True},
    {"link_id": "L14", "src": "HUB-RTR-01",  "dst": "SVC-VOIP",    "type": LinkType.PHYSICAL, "bw": 100, "mpls": False},
    {"link_id": "L15", "src": "HUB-RTR-01",  "dst": "SVC-ERP",     "type": LinkType.PHYSICAL, "bw": 100, "mpls": False},
    {"link_id": "L16", "src": "HUB-RTR-01",  "dst": "SVC-VIDEO",   "type": LinkType.PHYSICAL, "bw": 100, "mpls": False},
]

# Users per site (for blast radius user count)
SITE_USER_COUNT = {
    "HQ": 500, "SITE-A": 120, "SITE-B": 85,
    "SITE-C": 200, "SITE-D": 60, "DC1": 0, "DC2": 0, "TRANSIT": 0,
}


class NetworkDigitalTwin:
    """
    Living graph representation of the MPLS network.
    Wraps NetworkX DiGraph with real-time metric overlays,
    dependency analysis, and path computation.
    """

    def __init__(self):
        self.graph = nx.DiGraph()
        self.node_metrics: Dict[str, Dict] = {}
        self.link_metrics: Dict[str, Dict] = {}
        self.fault_state: Dict[str, bool] = {}   # node_id -> is_faulted
        self.last_updated = datetime.utcnow()
        self._build_topology()
        logger.info("NetworkDigitalTwin initialized", nodes=self.graph.number_of_nodes())

    def _build_topology(self):
        """Build the graph from the sample (or loaded) topology."""
        for n in SAMPLE_TOPOLOGY_NODES:
            self.graph.add_node(
                n["node_id"],
                label=n["label"],
                node_type=n["type"],
                site=n["site"],
                ip_address=n["ip"],
                position_x=n["x"],
                position_y=n["y"],
                is_critical=n["critical"],
                services=n["services"],
                vendor="Cisco",
            )
            self.node_metrics[n["node_id"]] = {
                "cpu_utilization": 0.0, "memory_utilization": 0.0,
                "bandwidth_utilization": 0.0, "packet_loss": 0.0,
                "latency_ms": 2.0, "error_rate": 0.0, "risk_score": 0.0,
            }
            self.fault_state[n["node_id"]] = False

        for l in SAMPLE_TOPOLOGY_LINKS:
            self.graph.add_edge(
                l["src"], l["dst"],
                link_id=l["link_id"],
                link_type=l["type"],
                bandwidth_mbps=l["bw"],
                is_mpls=l.get("mpls", False),
                tunnel_id=l.get("tunnel"),
                utilization=0.0,
                latency_ms=2.0,
                packet_loss=0.0,
                status="UP",
            )
            # Bidirectional for undirected traversal
            self.graph.add_edge(
                l["dst"], l["src"],
                link_id=l["link_id"] + "_REV",
                link_type=l["type"],
                bandwidth_mbps=l["bw"],
                is_mpls=l.get("mpls", False),
                tunnel_id=l.get("tunnel"),
                utilization=0.0,
                latency_ms=2.0,
                packet_loss=0.0,
                status="UP",
            )

    def update_node_metrics(self, node_id: str, metrics: Dict):
        """Update live metrics for a node."""
        if node_id in self.node_metrics:
            self.node_metrics[node_id].update(metrics)
            self.last_updated = datetime.utcnow()

    def update_link_metrics(self, src: str, dst: str, metrics: Dict):
        """Update live metrics for a link."""
        if self.graph.has_edge(src, dst):
            self.graph[src][dst].update(metrics)
            self.last_updated = datetime.utcnow()

    def inject_fault(self, node_id: str):
        """Simulate a node fault for demo/simulation."""
        self.fault_state[node_id] = True
        logger.warning("Fault injected", node=node_id)

    def clear_fault(self, node_id: str):
        """Clear a simulated fault."""
        self.fault_state[node_id] = False

    def get_topology(self) -> NetworkTopology:
        """Export the current topology as Pydantic model."""
        nodes = []
        for nid, data in self.graph.nodes(data=True):
            m = self.node_metrics.get(nid, {})
            risk = m.get("risk_score", 0.0)
            nodes.append(TopologyNode(
                node_id=nid,
                label=data.get("label", nid),
                node_type=data.get("node_type", NodeType.ROUTER),
                site=data.get("site"),
                ip_address=data.get("ip_address"),
                vendor=data.get("vendor"),
                position_x=data.get("position_x", 0),
                position_y=data.get("position_y", 0),
                risk_score=risk,
                risk_level=self._risk_to_level(risk),
                metrics={k: v for k, v in m.items() if v is not None},
                services=data.get("services", []),
                is_critical=data.get("is_critical", False),
            ))

        links = []
        seen = set()
        for src, dst, data in self.graph.edges(data=True):
            lid = data.get("link_id", f"{src}-{dst}")
            base_lid = lid.replace("_REV", "")
            if base_lid in seen:
                continue
            seen.add(base_lid)
            links.append(TopologyLink(
                link_id=base_lid,
                source=src,
                target=dst,
                link_type=data.get("link_type", LinkType.PHYSICAL),
                bandwidth_mbps=data.get("bandwidth_mbps"),
                utilization=data.get("utilization", 0.0),
                latency_ms=data.get("latency_ms", 0.0),
                packet_loss=data.get("packet_loss", 0.0),
                status=data.get("status", "UP"),
                is_mpls=data.get("is_mpls", False),
                tunnel_id=data.get("tunnel_id"),
            ))

        return NetworkTopology(nodes=nodes, links=links, last_updated=self.last_updated)

    def get_downstream_nodes(self, node_id: str, depth: int = 5) -> Set[str]:
        """BFS downstream from node_id to find all dependent nodes."""
        if node_id not in self.graph:
            return set()
        visited = set()
        queue = [(node_id, 0)]
        while queue:
            current, d = queue.pop(0)
            if current in visited or d > depth:
                continue
            visited.add(current)
            for neighbor in self.graph.successors(current):
                if neighbor not in visited:
                    queue.append((neighbor, d + 1))
        visited.discard(node_id)
        return visited

    def get_affected_sites(self, affected_nodes: Set[str]) -> List[str]:
        return list(set(
            self.graph.nodes[n].get("site", "UNKNOWN")
            for n in affected_nodes
            if n in self.graph.nodes
        ))

    def get_affected_services(self, affected_nodes: Set[str]) -> List[str]:
        services = set()
        for n in affected_nodes:
            if n in self.graph.nodes:
                services.update(self.graph.nodes[n].get("services", []))
        return list(services)

    def get_user_count(self, sites: List[str]) -> int:
        return sum(SITE_USER_COUNT.get(s, 0) for s in sites)

    def get_critical_path(self, src: str, dst: str) -> Optional[List[str]]:
        """Shortest path between two nodes."""
        try:
            return nx.shortest_path(self.graph, src, dst)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def get_all_paths(self, src: str, dst: str) -> List[List[str]]:
        """All simple paths (for redundancy analysis)."""
        try:
            return list(nx.all_simple_paths(self.graph, src, dst, cutoff=6))
        except (nx.NodeNotFound, nx.NetworkXError):
            return []

    def get_node_centrality(self) -> Dict[str, float]:
        """Betweenness centrality — identifies critical transit nodes."""
        return nx.betweenness_centrality(self.graph, normalized=True)

    def get_dependency_chain(self, service: str) -> List[str]:
        """Find all nodes required to deliver a named service."""
        return [
            nid for nid, data in self.graph.nodes(data=True)
            if service in data.get("services", [])
        ]

    def propagation_depth(self, node_id: str) -> int:
        """Max depth of impact propagation from node."""
        try:
            lengths = nx.single_source_shortest_path_length(self.graph, node_id)
            return max(lengths.values()) if lengths else 0
        except nx.NodeNotFound:
            return 0

    @staticmethod
    def _risk_to_level(score: float) -> RiskLevel:
        if score < 20: return RiskLevel.HEALTHY
        if score < 40: return RiskLevel.LOW
        if score < 60: return RiskLevel.MEDIUM
        if score < 80: return RiskLevel.HIGH
        return RiskLevel.CRITICAL


# Singleton instance shared across services
_twin_instance: Optional[NetworkDigitalTwin] = None


def get_twin() -> NetworkDigitalTwin:
    global _twin_instance
    if _twin_instance is None:
        _twin_instance = NetworkDigitalTwin()
    return _twin_instance
