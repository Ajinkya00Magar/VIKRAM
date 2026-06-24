"""
PS13 — FastAPI Main Application
Air-Gapped Predictive Copilot for Secure MPLS Operations.
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import structlog

from config import settings
from database import init_db
from services.rag.rag_engine import get_rag
from services.copilot.copilot import get_copilot
from services.digital_twin.twin import get_twin
from services.fault_injection.injector import get_fault_engine
from services.telemetry.telemetry_service import get_telemetry_service
from core.orchestrator import get_orchestrator
from routers.api import (
    topology_router, risk_router, predictions_router,
    blast_router, simulation_router, actions_router,
    copilot_router, rag_router, scenarios_router,
    telemetry_router, ws_router, graph_router,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("PS13 Mission Control starting up...")

    # 1. Initialize database
    try:
        await init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error("Database init failed (non-fatal)", error=str(e))

    # 2. Initialize Digital Twin
    twin = get_twin()
    logger.info("✅ Network Digital Twin ready", nodes=twin.graph.number_of_nodes())

    # 3. Initialize baseline telemetry (seed metrics)
    fault_engine = get_fault_engine()
    fault_engine.reset_all()
    logger.info("✅ Telemetry baseline seeded")

    # 4. Initialize RAG knowledge base
    try:
        rag = get_rag()
        rag.initialize()
        rag.index_all_runbooks()
        # Index sample incidents
        _seed_incidents(rag)
        logger.info("✅ RAG knowledge base initialized", stats=rag.get_stats())
    except Exception as e:
        logger.error("RAG init failed (non-fatal, using fallback)", error=str(e))

    # 5. Check Ollama availability
    try:
        copilot = get_copilot()
        available = await copilot.check_availability()
        if not available:
            logger.warning("Ollama not ready. Run: docker exec ps13-ollama ollama pull mistral:7b-instruct")
        else:
            logger.info("✅ AI Copilot (Ollama) ready", model=copilot._model)
    except Exception as e:
        logger.warning("Copilot init failed (rule-based fallback active)", error=str(e))

    # 6. Start telemetry service
    telemetry_svc = get_telemetry_service()
    await telemetry_svc.initialize()
    telemetry_task = asyncio.create_task(
        telemetry_svc.run(interval_seconds=settings.telemetry_poll_interval)
    )
    logger.info("✅ Telemetry service started")

    # 7. Start background orchestrator
    orchestrator = get_orchestrator()
    orch_task = asyncio.create_task(orchestrator.start())
    logger.info("✅ Orchestrator started")

    logger.info("🚀 PS13 Mission Control is LIVE", port=settings.backend_port)

    yield

    # Shutdown
    logger.info("PS13 shutting down...")
    orchestrator.stop()
    telemetry_svc.stop()
    telemetry_task.cancel()
    orch_task.cancel()
    try:
        await telemetry_task
        await orch_task
    except asyncio.CancelledError:
        pass
    logger.info("PS13 shutdown complete")


def _seed_incidents(rag):
    """Seed sample incident history into RAG."""
    incidents = [
        {
            "id": "INC-2024-001",
            "description": "HUB-RTR-01 congestion causing VoIP degradation at SITE-A and SITE-B",
            "root_cause": "Unscheduled bulk backup jobs from SITE-B bypassing QoS policy",
            "resolution": "Applied rate limiting (RB-NET-004) and rescheduled backups to off-peak hours",
            "tags": ["congestion", "voip", "qos", "hub"],
        },
        {
            "id": "INC-2024-002",
            "description": "BGP-PEER-01 session flapping causing internet prefix loss",
            "root_cause": "ISP upstream congestion causing keepalive timer violations",
            "resolution": "Applied soft-clear BGP session (RB-NET-003), ISP resolved upstream congestion",
            "tags": ["bgp", "flap", "internet", "prefix"],
        },
        {
            "id": "INC-2024-003",
            "description": "IPSec tunnel between SPOKE-RTR-A and HUB-RTR-01 degraded",
            "root_cause": "WAN link packet corruption causing IKE SA renegotiation loops",
            "resolution": "Restarted tunnel (RB-NET-002), ISP replaced faulty cable on WAN link",
            "tags": ["tunnel", "ipsec", "degradation", "spoke"],
        },
        {
            "id": "INC-2024-004",
            "description": "MPLS-PE-01 FIB table exhaustion causing LSP collapse",
            "root_cause": "Route leaking from BGP into MPLS LDP table exceeded hardware limit",
            "resolution": "Reset MPLS paths (RB-NET-006), applied route filtering to prevent leak",
            "tags": ["mpls", "pe", "lsp", "fib", "label"],
        },
        {
            "id": "INC-2024-005",
            "description": "SD-WAN policy update pushed incorrect DSCP markings for VoIP",
            "root_cause": "Controller firmware upgrade reset QoS templates to default",
            "resolution": "Increased QoS priority (RB-NET-007), restored VoIP DSCP EF marking",
            "tags": ["sdwan", "qos", "dscp", "voip", "policy"],
        },
    ]
    for inc in incidents:
        rag.index_incident(
            inc["id"], inc["description"], inc["root_cause"],
            inc["resolution"], inc["tags"]
        )


# ──────────────────────────────────────────────────────
# APPLICATION
# ──────────────────────────────────────────────────────

app = FastAPI(
    title="PS13 — Air-Gapped Predictive Copilot for Secure MPLS Operations",
    description="Offline AI-powered Network Operations Center",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(topology_router)
app.include_router(risk_router)
app.include_router(predictions_router)
app.include_router(blast_router)
app.include_router(simulation_router)
app.include_router(actions_router)
app.include_router(copilot_router)
app.include_router(rag_router)
app.include_router(scenarios_router)
app.include_router(telemetry_router)
app.include_router(graph_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    twin = get_twin()
    return {
        "status": "operational",
        "system": "PS13 Mission Control",
        "air_gapped": True,
        "nodes": twin.graph.number_of_nodes(),
        "links": twin.graph.number_of_edges() // 2,
    }


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/")
async def root():
    return {
        "system": "PS13 — Air-Gapped Predictive Copilot for Secure MPLS Operations",
        "status": "OPERATIONAL",
        "docs": "/docs",
        "websocket": "/ws",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
