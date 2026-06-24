"""
PS13 — Demo Data Generator
Seeds:
  1. PostgreSQL — incident history
  2. InfluxDB — 48h historical telemetry
  3. ChromaDB — runbooks + incidents (via RAG engine)
Run via: python data/generate_demo_data.py
"""
import asyncio
import os
import sys
import random
import math
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, "/app")

async def seed_influxdb():
    """Write 48h of synthetic telemetry to InfluxDB."""
    try:
        from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
        from influxdb_client import Point

        client = InfluxDBClientAsync(
            url=os.environ.get("INFLUXDB_URL", "http://influxdb:8086"),
            token=os.environ.get("INFLUXDB_TOKEN", "dev"),
            org=os.environ.get("INFLUXDB_ORG", "ps13"),
        )

        NODES = {
            "HUB-RTR-01":  {"cpu": 35, "bw": 30, "latency": 5},
            "MPLS-PE-01":  {"cpu": 28, "bw": 45, "latency": 3},
            "MPLS-PE-02":  {"cpu": 25, "bw": 40, "latency": 3},
            "SDWAN-CTRL":  {"cpu": 22, "bw": 10, "latency": 4},
            "SPOKE-RTR-A": {"cpu": 18, "bw": 15, "latency": 12},
            "SPOKE-RTR-B": {"cpu": 20, "bw": 20, "latency": 15},
            "SPOKE-RTR-C": {"cpu": 22, "bw": 18, "latency": 13},
            "SPOKE-RTR-D": {"cpu": 15, "bw": 12, "latency": 18},
        }

        bucket = os.environ.get("INFLUXDB_BUCKET", "network_telemetry")
        org    = os.environ.get("INFLUXDB_ORG", "ps13")

        write_api = client.write_api()
        points = []
        now = datetime.utcnow()

        # 48h of data at 5-minute intervals = 576 points per node
        for minutes_ago in range(0, 48 * 60, 5):
            ts = now - timedelta(minutes=minutes_ago)
            hour = ts.hour
            tod = 1.0 + 0.4 * math.sin(math.pi * (hour - 8) / 10) if 8 <= hour <= 18 else 0.7

            for node_id, baseline in NODES.items():
                noise = random.gauss(0, 1.5)
                point = (
                    Point("network_telemetry")
                    .tag("node_id", node_id)
                    .field("cpu_utilization",       float(round(min(baseline["cpu"] * tod + noise, 100), 2)))
                    .field("bandwidth_utilization", float(round(min(baseline["bw"] * tod + noise, 100), 2)))
                    .field("latency_ms",            float(round(max(baseline["latency"] + abs(noise) * 0.5, 1), 2)))
                    .field("packet_loss",           float(round(max(random.gauss(0, 0.05), 0), 4)))
                    .field("memory_utilization",    float(round(min(45 + random.gauss(0, 3), 100), 2)))
                    .field("error_rate",            float(round(max(random.gauss(0, 0.02), 0), 4)))
                    .field("jitter_ms",             float(round(max(random.gauss(1.5, 0.4), 0), 2)))
                    .field("qos_drop_rate",         float(round(max(random.gauss(0, 0.1), 0), 3)))
                    .time(ts)
                )
                points.append(point)

            # Batch write every 500 points
            if len(points) >= 500:
                await write_api.write(bucket=bucket, org=org, record=points)
                points = []

        if points:
            await write_api.write(bucket=bucket, org=org, record=points)

        await client.close()
        print(f"✅ InfluxDB seeded: {48 * 60 // 5 * len(NODES)} telemetry points")

    except Exception as e:
        print(f"⚠️  InfluxDB seed failed (non-fatal): {e}")


async def seed_chromadb():
    """Index all runbooks into ChromaDB."""
    try:
        from services.rag.rag_engine import get_rag
        rag = get_rag()
        rag.initialize()
        rag.index_all_runbooks()

        # Seed incidents
        incidents = [
            ("INC-2024-001", "HUB-RTR-01 congestion degraded VoIP across 3 sites for 45 minutes",
             "Unscheduled nightly backup jobs from SITE-B saturated WAN link without QoS classification",
             "Applied rate-limit policy (RB-NET-004), rescheduled backups to 02:00 AM",
             ["congestion", "voip", "hub", "qos"]),
            ("INC-2024-002", "BGP-PEER-01 session down, internet loss for 18 minutes",
             "ISP upstream link congestion caused keepalive timer violation on BGP session",
             "Soft-cleared BGP session (RB-NET-003). ISP resolved congestion upstream.",
             ["bgp", "flap", "internet", "isp"]),
            ("INC-2024-003", "SPOKE-RTR-A tunnel degraded, VoIP MOS below threshold",
             "Faulty cable on last-mile WAN causing intermittent packet corruption in IPSec tunnel",
             "Restarted tunnel (RB-NET-002), ISP replaced faulty cable within 4 hours",
             ["tunnel", "ipsec", "degradation", "spoke"]),
            ("INC-2024-004", "MPLS-PE-01 FIB table full, LSP collapse, 6 sites affected",
             "BGP route leak injected 11,000+ prefixes into MPLS LDP table, exceeding hardware limit",
             "Reset MPLS paths (RB-NET-006), applied prefix filter to block leak",
             ["mpls", "pe", "lsp", "fib", "route-leak"]),
            ("INC-2024-005", "VoIP quality degradation across all sites after SD-WAN firmware upgrade",
             "Controller firmware 7.4.2 reset QoS profiles to defaults, demoting VoIP to best-effort",
             "Restored QoS templates from backup, re-pushed policy (RB-NET-007)",
             ["sdwan", "qos", "voip", "firmware", "policy"]),
            ("INC-2024-006", "SPOKE-RTR-D tunnel down for 2 hours overnight",
             "IKE Phase 1 certificate expired on spoke router",
             "Renewed certificate, re-established tunnel. Added certificate expiry monitoring to PS13",
             ["tunnel", "ipsec", "certificate", "ike"]),
        ]
        for inc_id, desc, cause, res, tags in incidents:
            rag.index_incident(inc_id, desc, cause, res, tags)

        print(f"✅ ChromaDB seeded: runbooks + {len(incidents)} incidents")
        print(f"   Stats: {rag.get_stats()}")

    except Exception as e:
        print(f"⚠️  ChromaDB seed failed (non-fatal): {e}")


async def seed_postgres():
    """Insert sample incident history into PostgreSQL."""
    try:
        import asyncpg
        conn = await asyncpg.connect(os.environ.get("DATABASE_URL", "").replace("+asyncpg", ""))

        incidents = [
            ("INC-2024-001", "Hub congestion", "Backup jobs saturated WAN", "Rate limit applied", ["congestion","voip"]),
            ("INC-2024-002", "BGP flap", "ISP keepalive violation", "BGP soft-clear", ["bgp","internet"]),
            ("INC-2024-003", "Tunnel degradation", "Faulty cable", "Tunnel restart", ["tunnel","ipsec"]),
        ]
        for inc_id, desc, cause, res, tags in incidents:
            await conn.execute(
                """
                INSERT INTO incidents (incident_id, description, root_cause, resolution, tags)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (incident_id) DO NOTHING
                """,
                inc_id, desc, cause, res, tags,
            )
        await conn.close()
        print("✅ PostgreSQL seeded: 3 incidents")

    except Exception as e:
        print(f"⚠️  PostgreSQL seed failed (non-fatal): {e}")


async def main():
    print("=" * 60)
    print("PS13 — Demo Data Generator")
    print("=" * 60)

    # Small delay to ensure services are ready
    import asyncio
    await asyncio.sleep(5)

    await seed_postgres()
    await seed_influxdb()
    await seed_chromadb()

    print("=" * 60)
    print("✅ Demo data generation complete")
    print("   Access PS13 at: http://localhost:3000")
    print("   Backend API:    http://localhost:8000/docs")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
