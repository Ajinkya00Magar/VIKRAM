"""
PS13 — Telemetry Service
Generates synthetic real-time telemetry for all nodes.
Writes to InfluxDB. Drives the prediction engine.
In production: replace synthetic generator with SNMP/NetFlow collectors.
<<EXPORTER_CONFIGURATION_REQUIRED>> for real device integration.
"""
import asyncio
import random
import math
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import structlog

from services.digital_twin.twin import get_twin
from services.prediction.predictor import get_predictor

logger = structlog.get_logger(__name__)

# Baseline metrics per node type
NODE_BASELINES = {
    "HUB-RTR-01":  {"cpu": 35, "mem": 55, "bw": 30, "latency": 5,  "loss": 0.0, "jitter": 1.2},
    "MPLS-PE-01":  {"cpu": 28, "mem": 48, "bw": 45, "latency": 3,  "loss": 0.0, "jitter": 0.8},
    "MPLS-PE-02":  {"cpu": 25, "mem": 45, "bw": 40, "latency": 3,  "loss": 0.0, "jitter": 0.8},
    "SDWAN-CTRL":  {"cpu": 22, "mem": 40, "bw": 10, "latency": 4,  "loss": 0.0, "jitter": 0.5},
    "SPOKE-RTR-A": {"cpu": 18, "mem": 35, "bw": 15, "latency": 12, "loss": 0.0, "jitter": 2.0},
    "SPOKE-RTR-B": {"cpu": 20, "mem": 38, "bw": 20, "latency": 15, "loss": 0.0, "jitter": 2.5},
    "SPOKE-RTR-C": {"cpu": 22, "mem": 42, "bw": 18, "latency": 13, "loss": 0.0, "jitter": 2.2},
    "SPOKE-RTR-D": {"cpu": 15, "mem": 30, "bw": 12, "latency": 18, "loss": 0.0, "jitter": 3.0},
    "BGP-PEER-01": {"cpu": 45, "mem": 60, "bw": 70, "latency": 8,  "loss": 0.0, "jitter": 1.0},
    "SVC-VOIP":    {"cpu": 30, "mem": 55, "bw": 25, "latency": 5,  "loss": 0.0, "jitter": 1.5},
    "SVC-ERP":     {"cpu": 60, "mem": 70, "bw": 35, "latency": 8,  "loss": 0.0, "jitter": 0.8},
    "SVC-VIDEO":   {"cpu": 40, "mem": 65, "bw": 55, "latency": 6,  "loss": 0.0, "jitter": 1.0},
}


class TelemetryService:
    """
    Synthetic telemetry generator.
    Adds realistic time-of-day patterns, noise, and periodic spikes.
    In production, this class is replaced by real SNMP/NetFlow collectors.
    """

    def __init__(self):
        self._tick = 0
        self._running = False
        self._influx_available = False
        self._influx_client = None

    async def initialize(self):
        """Try to connect to InfluxDB."""
        try:
            import os
            from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
            self._influx_client = InfluxDBClientAsync(
                url=os.environ.get("INFLUXDB_URL", "http://influxdb:8086"),
                token=os.environ.get("INFLUXDB_TOKEN", "dev"),
                org=os.environ.get("INFLUXDB_ORG", "ps13"),
            )
            self._influx_available = True
            logger.info("InfluxDB telemetry writer connected")
        except Exception as e:
            logger.warning("InfluxDB not available, telemetry in-memory only", error=str(e))

    async def run(self, interval_seconds: int = 5):
        """Main telemetry loop — runs forever."""
        self._running = True
        logger.info("Telemetry service started", interval=interval_seconds)
        while self._running:
            await self._tick_all_nodes()
            self._tick += 1
            await asyncio.sleep(interval_seconds)

    def stop(self):
        self._running = False

    async def _tick_all_nodes(self):
        """Generate metrics for all nodes and push to twin + InfluxDB."""
        twin = get_twin()
        predictor = get_predictor()
        now = datetime.utcnow()
        hour = now.hour
        # Time-of-day multiplier (business hours = higher load)
        tod_multiplier = 1.0 + 0.4 * math.sin(math.pi * (hour - 8) / 10) if 8 <= hour <= 18 else 0.7

        for node_id, baseline in NODE_BASELINES.items():
            # Get current metrics from twin (fault injection may have modified them)
            twin_metrics = twin.node_metrics.get(node_id, {})

            metrics = self._generate_metrics(
                node_id, baseline, twin_metrics, tod_multiplier, self._tick
            )

            # Update digital twin
            twin.update_node_metrics(node_id, metrics)

            # Feed predictor
            predictor.ingest_telemetry(node_id, metrics)

            # Write to InfluxDB
            if self._influx_available:
                await self._write_influx(node_id, metrics, now)

    def _generate_metrics(self, node_id: str, baseline: Dict,
                          current: Dict, tod_mult: float, tick: int) -> Dict:
        """
        Generate realistic metrics with noise, drift, and tod patterns.
        If fault injection has elevated values, preserve those.
        """
        def noisy(base, sigma=2.0):
            return max(0.0, base + random.gauss(0, sigma))

        def with_drift(base, current_val, drift_factor=0.05):
            """Smoothly drift toward current fault-injected value."""
            target = current_val if current_val > base * 1.1 else base * tod_mult
            return base + (target - base) * drift_factor + random.gauss(0, base * 0.02)

        # CPU utilization
        base_cpu = baseline["cpu"] * tod_mult
        current_cpu = current.get("cpu_utilization", base_cpu)
        cpu = with_drift(base_cpu, current_cpu)

        # Bandwidth utilization  
        base_bw = baseline["bw"] * tod_mult
        current_bw = current.get("bandwidth_utilization", base_bw)
        bw = with_drift(base_bw, current_bw)

        # Memory
        mem = noisy(baseline["mem"] + tick * 0.001 % 5, 1.5)  # slow memory drift

        # Latency
        base_lat = baseline["latency"]
        current_lat = current.get("latency_ms", base_lat)
        lat = max(1.0, with_drift(base_lat, current_lat, 0.1))

        # Packet loss
        base_loss = baseline["loss"]
        current_loss = current.get("packet_loss", 0.0)
        loss = max(0.0, with_drift(base_loss + 0.001, current_loss, 0.15))

        # Jitter
        jitter = max(0.0, noisy(baseline["jitter"] + loss * 2, 0.5))

        # Error rate
        current_err = current.get("error_rate", 0.0)
        error_rate = max(0.0, with_drift(0.01, current_err, 0.2))

        # QoS drop rate
        current_qos = current.get("qos_drop_rate", 0.0)
        qos_drop = max(0.0, with_drift(0.0, current_qos, 0.2))

        # Special fields
        bgp_prefixes = current.get("bgp_prefixes") or (10000 if "BGP" in node_id else None)
        mpls_labels = current.get("mpls_label_count") or (random.randint(4800, 5200) if "PE" in node_id else None)
        tunnel_up = current.get("tunnel_uptime", 99.9) if "SPOKE" in node_id else None

        metrics = {
            "cpu_utilization": round(min(cpu, 100), 2),
            "memory_utilization": round(min(mem, 100), 2),
            "bandwidth_utilization": round(min(bw, 100), 2),
            "packet_loss": round(min(loss, 100), 3),
            "latency_ms": round(min(lat, 999), 2),
            "jitter_ms": round(min(jitter, 100), 2),
            "error_rate": round(min(error_rate, 100), 3),
            "qos_drop_rate": round(min(qos_drop, 100), 2),
        }
        if bgp_prefixes is not None:
            metrics["bgp_prefixes"] = int(bgp_prefixes)
        if mpls_labels is not None:
            metrics["mpls_label_count"] = int(mpls_labels)
        if tunnel_up is not None:
            metrics["tunnel_uptime"] = round(tunnel_up, 2)

        return metrics

    async def _write_influx(self, node_id: str, metrics: Dict, timestamp: datetime):
        """Write telemetry point to InfluxDB."""
        try:
            import os
            from influxdb_client import Point
            from influxdb_client.client.write_api import SYNCHRONOUS

            write_api = self._influx_client.write_api()
            point = Point("network_telemetry").tag("node_id", node_id)
            for field, value in metrics.items():
                if value is not None:
                    point = point.field(field, float(value))
            point = point.time(timestamp)
            await write_api.write(
                bucket=os.environ.get("INFLUXDB_BUCKET", "network_telemetry"),
                org=os.environ.get("INFLUXDB_ORG", "ps13"),
                record=point,
            )
        except Exception as e:
            logger.debug("InfluxDB write failed (non-fatal)", error=str(e))

    def get_current_metrics(self) -> Dict[str, Dict]:
        """Return current in-memory metrics snapshot."""
        return dict(get_twin().node_metrics)


_telemetry_service: Optional[TelemetryService] = None


def get_telemetry_service() -> TelemetryService:
    global _telemetry_service
    if _telemetry_service is None:
        _telemetry_service = TelemetryService()
    return _telemetry_service
