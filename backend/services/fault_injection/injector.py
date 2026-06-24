"""
PS13 — Fault Injection Engine
Injects synthetic faults into the digital twin for demo scenarios.
Scenarios: Hub Congestion, BGP Flap, Tunnel Degradation, MPLS Failure, Policy Drift.
"""
import asyncio
import random
from datetime import datetime
from typing import Dict, Optional, Callable, Awaitable
import structlog

from models.schemas import ScenarioType, IssueType
from services.digital_twin.twin import get_twin

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# SCENARIO DEFINITIONS
# Each scenario is a progression of metric changes
# applied to specific nodes over time
# ──────────────────────────────────────────────────────

SCENARIO_CONFIGS = {
    ScenarioType.HUB_CONGESTION: {
        "trigger_node": "HUB-RTR-01",
        "issue_type": IssueType.CONGESTION,
        "description": "Progressive Hub Router Congestion — bandwidth saturation on HQ hub",
        "lead_time_minutes": 45,
        "root_cause": "Bulk backup jobs from SITE-B and SITE-C saturating WAN uplink without QoS",
        "metric_progression": [
            # (step, node_id, metrics_delta)
            (0,  "HUB-RTR-01", {"bandwidth_utilization": 55, "cpu_utilization": 40, "packet_loss": 0.1, "latency_ms": 8}),
            (1,  "HUB-RTR-01", {"bandwidth_utilization": 65, "cpu_utilization": 52, "packet_loss": 0.2, "latency_ms": 12}),
            (2,  "HUB-RTR-01", {"bandwidth_utilization": 75, "cpu_utilization": 63, "packet_loss": 0.5, "latency_ms": 18}),
            (3,  "HUB-RTR-01", {"bandwidth_utilization": 83, "cpu_utilization": 72, "packet_loss": 1.2, "latency_ms": 28, "qos_drop_rate": 3.0}),
            (4,  "HUB-RTR-01", {"bandwidth_utilization": 91, "cpu_utilization": 81, "packet_loss": 2.8, "latency_ms": 45, "qos_drop_rate": 7.5, "jitter_ms": 8}),
            (4,  "SPOKE-RTR-B", {"bandwidth_utilization": 78, "latency_ms": 35, "packet_loss": 1.0}),
            (4,  "SPOKE-RTR-C", {"bandwidth_utilization": 71, "latency_ms": 30, "packet_loss": 0.8}),
        ],
    },

    ScenarioType.BGP_ROUTE_FLAP: {
        "trigger_node": "BGP-PEER-01",
        "issue_type": IssueType.BGP_FLAP,
        "description": "BGP Route Flap — transit peer session instability causing route churn",
        "lead_time_minutes": 15,
        "root_cause": "ISP transit BGP session experiencing keepalive timer violations due to upstream congestion",
        "metric_progression": [
            (0,  "BGP-PEER-01", {"error_rate": 0.3, "latency_ms": 15, "packet_loss": 0.1}),
            (1,  "BGP-PEER-01", {"error_rate": 0.8, "latency_ms": 22, "packet_loss": 0.3, "bgp_prefixes": 9800}),
            (2,  "BGP-PEER-01", {"error_rate": 1.5, "latency_ms": 35, "packet_loss": 0.8, "bgp_prefixes": 8500}),
            (3,  "BGP-PEER-01", {"error_rate": 3.2, "latency_ms": 55, "packet_loss": 2.1, "bgp_prefixes": 4200}),
            (4,  "BGP-PEER-01", {"error_rate": 5.5, "latency_ms": 90, "packet_loss": 5.0, "bgp_prefixes": 0}),
            (4,  "MPLS-PE-01",  {"error_rate": 2.0, "latency_ms": 40, "route_instability": 1.0}),
            (4,  "HUB-RTR-01",  {"latency_ms": 60, "packet_loss": 3.5}),
        ],
    },

    ScenarioType.TUNNEL_DEGRADATION: {
        "trigger_node": "SPOKE-RTR-A",
        "issue_type": IssueType.TUNNEL_DEGRADATION,
        "description": "IPSec Tunnel Degradation — spoke-to-hub tunnel quality degrading",
        "lead_time_minutes": 30,
        "root_cause": "Underlying WAN link experiencing intermittent packet corruption causing IPSec SA renegotiation cycles",
        "metric_progression": [
            (0,  "SPOKE-RTR-A", {"tunnel_uptime": 99.8, "packet_loss": 0.1, "latency_ms": 12, "jitter_ms": 2}),
            (1,  "SPOKE-RTR-A", {"tunnel_uptime": 98.5, "packet_loss": 0.5, "latency_ms": 20, "jitter_ms": 5}),
            (2,  "SPOKE-RTR-A", {"tunnel_uptime": 95.2, "packet_loss": 1.8, "latency_ms": 38, "jitter_ms": 12}),
            (3,  "SPOKE-RTR-A", {"tunnel_uptime": 88.0, "packet_loss": 4.5, "latency_ms": 72, "jitter_ms": 25, "error_rate": 2.0}),
            (4,  "SPOKE-RTR-A", {"tunnel_uptime": 71.0, "packet_loss": 8.2, "latency_ms": 120, "jitter_ms": 45, "error_rate": 5.5}),
        ],
    },

    ScenarioType.MPLS_FAILURE: {
        "trigger_node": "MPLS-PE-01",
        "issue_type": IssueType.MPLS_FAILURE,
        "description": "MPLS PE Router Failure — label-switched path collapse across core",
        "lead_time_minutes": 12,
        "root_cause": "MPLS PE-01 experiencing LDP session flap due to hardware FIB table exhaustion",
        "metric_progression": [
            (0,  "MPLS-PE-01",  {"cpu_utilization": 65, "error_rate": 0.5, "mpls_label_count": 9500}),
            (1,  "MPLS-PE-01",  {"cpu_utilization": 78, "error_rate": 1.2, "mpls_label_count": 9800, "packet_loss": 0.3}),
            (2,  "MPLS-PE-01",  {"cpu_utilization": 89, "error_rate": 3.5, "mpls_label_count": 10240, "packet_loss": 1.5}),
            (3,  "MPLS-PE-01",  {"cpu_utilization": 97, "error_rate": 8.0, "mpls_label_count": 10240, "packet_loss": 5.0}),
            (4,  "MPLS-PE-01",  {"cpu_utilization": 99, "error_rate": 15.0, "packet_loss": 18.0, "bandwidth_utilization": 0}),
            (4,  "SPOKE-RTR-A", {"packet_loss": 12.0, "latency_ms": 200, "bandwidth_utilization": 0}),
            (4,  "SPOKE-RTR-B", {"packet_loss": 10.0, "latency_ms": 180, "bandwidth_utilization": 0}),
            (4,  "HUB-RTR-01",  {"packet_loss": 8.0, "latency_ms": 150}),
        ],
    },

    ScenarioType.POLICY_DRIFT: {
        "trigger_node": "SDWAN-CTRL",
        "issue_type": IssueType.POLICY_DRIFT,
        "description": "SD-WAN Policy Drift — QoS configuration drift causing VoIP degradation",
        "lead_time_minutes": 90,
        "root_cause": "SD-WAN controller policy update pushed incorrect DSCP markings, demoting VoIP to best-effort class",
        "metric_progression": [
            (0,  "SDWAN-CTRL",  {"qos_drop_rate": 1.0, "cpu_utilization": 30}),
            (1,  "SDWAN-CTRL",  {"qos_drop_rate": 3.5, "cpu_utilization": 35}),
            (1,  "SVC-VOIP",    {"latency_ms": 25, "jitter_ms": 8, "packet_loss": 0.5}),
            (2,  "SDWAN-CTRL",  {"qos_drop_rate": 7.0, "cpu_utilization": 40}),
            (2,  "SVC-VOIP",    {"latency_ms": 45, "jitter_ms": 18, "packet_loss": 1.2}),
            (3,  "SDWAN-CTRL",  {"qos_drop_rate": 12.0, "cpu_utilization": 45}),
            (3,  "SVC-VOIP",    {"latency_ms": 80, "jitter_ms": 35, "packet_loss": 3.0}),
            (4,  "SDWAN-CTRL",  {"qos_drop_rate": 20.0, "cpu_utilization": 50}),
            (4,  "SVC-VOIP",    {"latency_ms": 150, "jitter_ms": 60, "packet_loss": 6.0}),
            (4,  "SPOKE-RTR-C", {"qos_drop_rate": 8.0, "latency_ms": 55}),
        ],
    },
}


class FaultInjectionEngine:
    """
    Injects synthetic faults into the digital twin for demonstration.
    Can run scenarios progressively (step-by-step) or instantly (jump to max severity).
    """

    def __init__(self):
        self._active_scenario: Optional[ScenarioType] = None
        self._scenario_step: int = 0
        self._step_callback: Optional[Callable] = None

    @property
    def active_scenario(self) -> Optional[ScenarioType]:
        return self._active_scenario

    def inject_scenario(self, scenario_type: ScenarioType,
                        step: Optional[int] = None) -> Dict:
        """
        Inject a scenario at a specific step (0=mild → 4=critical).
        If step is None, advance to next step.
        """
        config = SCENARIO_CONFIGS.get(scenario_type)
        if not config:
            raise ValueError(f"Unknown scenario: {scenario_type}")

        if step is None:
            if self._active_scenario != scenario_type:
                self._active_scenario = scenario_type
                self._scenario_step = 0
                step = 0
            else:
                self._scenario_step = min(self._scenario_step + 1, 4)
                step = self._scenario_step
        else:
            self._active_scenario = scenario_type
            self._scenario_step = step

        twin = get_twin()
        for s, node_id, metrics in config["metric_progression"]:
            if s <= step:
                twin.update_node_metrics(node_id, metrics)

        severity = ["HEALTHY", "LOW", "MEDIUM", "HIGH", "CRITICAL"][step]
        logger.info("Fault injected",
                    scenario=scenario_type.value, step=step, severity=severity)

        return {
            "scenario": scenario_type.value,
            "step": step,
            "severity": severity,
            "trigger_node": config["trigger_node"],
            "issue_type": config["issue_type"].value,
            "description": config["description"],
            "root_cause": config["root_cause"],
            "lead_time_minutes": config["lead_time_minutes"],
        }

    def inject_full_scenario(self, scenario_type: ScenarioType) -> Dict:
        """Jump directly to maximum severity (step 4)."""
        return self.inject_scenario(scenario_type, step=4)

    def reset_all(self):
        """Reset digital twin to baseline metrics."""
        twin = get_twin()
        for node_id in twin.graph.nodes:
            metrics = {
                "cpu_utilization": random.uniform(15, 30),
                "memory_utilization": random.uniform(30, 50),
                "bandwidth_utilization": random.uniform(10, 25),
                "packet_loss": 0.0,
                "latency_ms": random.uniform(2, 8),
                "jitter_ms": random.uniform(0.5, 2),
                "error_rate": 0.0,
                "qos_drop_rate": 0.0,
                "risk_score": 0.0,
            }
            if "BGP" in node_id:
                metrics["bgp_prefixes"] = 10000
            if "PE" in node_id:
                metrics["mpls_label_count"] = 5000
            if "SPOKE" in node_id:
                metrics["tunnel_uptime"] = 99.9
            
            twin.node_metrics[node_id] = metrics
        twin.fault_state = {n: False for n in twin.graph.nodes}
        self._active_scenario = None
        self._scenario_step = 0
        logger.info("All faults reset to baseline")

    def get_scenario_info(self, scenario_type: ScenarioType) -> Dict:
        """Return scenario metadata for UI display."""
        config = SCENARIO_CONFIGS.get(scenario_type)
        if not config:
            return {}
        return {
            "scenario_type": scenario_type.value,
            "trigger_node": config["trigger_node"],
            "issue_type": config["issue_type"].value,
            "description": config["description"],
            "lead_time_minutes": config["lead_time_minutes"],
            "root_cause": config["root_cause"],
            "step_count": 5,
        }


_engine: Optional[FaultInjectionEngine] = None


def get_fault_engine() -> FaultInjectionEngine:
    global _engine
    if _engine is None:
        _engine = FaultInjectionEngine()
    return _engine
