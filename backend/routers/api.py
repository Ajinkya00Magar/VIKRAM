"""
PS13 — API Routers
All HTTP endpoints for the PS13 system.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import structlog

from models.schemas import (
    CopilotQuery, ScenarioType, IssueType, ActionType,
    SimulationAction
)
from services.digital_twin.twin import get_twin
from services.prediction.predictor import get_predictor
from services.risk.risk_engine import get_risk_engine
from services.blast_radius.analyzer import get_analyzer
from services.simulation.counterfactual import get_simulation_engine
from services.action_ranking.ranker import get_ranker
from services.copilot.copilot import get_copilot
from services.rag.rag_engine import get_rag
from services.fault_injection.injector import get_fault_engine, SCENARIO_CONFIGS
from services.telemetry.telemetry_service import get_telemetry_service
from services.graph.graph_engine import get_graph_engine
from core.websocket_manager import manager

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────
# TOPOLOGY ROUTER
# ──────────────────────────────────────────────────────

topology_router = APIRouter(prefix="/api/topology", tags=["Topology"])


@topology_router.get("")
async def get_topology():
    """Return full network topology with live metrics."""
    twin = get_twin()
    topo = twin.get_topology()
    return topo.model_dump()


@topology_router.get("/nodes/{node_id}")
async def get_node(node_id: str):
    """Get single node details."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    data = twin.graph.nodes[node_id]
    metrics = twin.node_metrics.get(node_id, {})
    risk = get_risk_engine().get_last_score(node_id)
    return {
        "node_id": node_id,
        "data": dict(data),
        "metrics": metrics,
        "risk": risk.model_dump() if risk else None,
    }


@topology_router.get("/centrality")
async def get_centrality():
    """Return betweenness centrality for all nodes (critical transit nodes)."""
    twin = get_twin()
    return twin.get_node_centrality()


@topology_router.get("/paths")
async def get_paths(src: str, dst: str):
    """Return all simple paths between two nodes."""
    twin = get_twin()
    paths = twin.get_all_paths(src, dst)
    return {"source": src, "destination": dst, "paths": paths, "count": len(paths)}


# ──────────────────────────────────────────────────────
# RISK ROUTER
# ──────────────────────────────────────────────────────

risk_router = APIRouter(prefix="/api/risk", tags=["Risk"])


@risk_router.get("")
async def get_system_risk():
    """Return system-wide risk summary."""
    twin = get_twin()
    risk_engine = get_risk_engine()
    all_scores = []
    for node_id in twin.graph.nodes:
        metrics = twin.node_metrics.get(node_id, {})
        is_critical = twin.graph.nodes[node_id].get("is_critical", False)
        score = risk_engine.compute(node_id, metrics, is_critical)
        all_scores.append(score)
    summary = risk_engine.compute_system(all_scores, 0)
    return summary.model_dump()


@risk_router.get("/node/{node_id}")
async def get_node_risk(node_id: str):
    """Return risk score for a specific node."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    metrics = twin.node_metrics.get(node_id, {})
    is_critical = twin.graph.nodes[node_id].get("is_critical", False)
    score = get_risk_engine().compute(node_id, metrics, is_critical)
    return score.model_dump()


@risk_router.get("/history/{node_id}")
async def get_risk_history(node_id: str, hours: int = 1):
    """Return risk score history from InfluxDB (or synthetic)."""
    # <<INFLUXDB_QUERY_IMPLEMENTATION>>
    # In production, query InfluxDB for historical risk scores
    import random
    now = datetime.utcnow()
    points = []
    for i in range(hours * 12):  # 5-minute intervals
        t = now.replace(microsecond=0) - __import__('datetime').timedelta(minutes=i * 5)
        points.append({"timestamp": t.isoformat(), "risk_score": round(random.uniform(5, 45), 1)})
    return {"node_id": node_id, "history": list(reversed(points))}


# ──────────────────────────────────────────────────────
# PREDICTIONS ROUTER
# ──────────────────────────────────────────────────────

predictions_router = APIRouter(prefix="/api/predictions", tags=["Predictions"])


@predictions_router.get("")
async def get_predictions(min_risk: float = 20.0):
    """Return all active predictions above risk threshold."""
    twin = get_twin()
    predictor = get_predictor()
    results = []
    for node_id in twin.graph.nodes:
        metrics = twin.node_metrics.get(node_id, {})
        affected = list(twin.get_downstream_nodes(node_id, depth=3))
        pred = predictor.predict(node_id, metrics, affected)
        if pred and pred.risk_score >= min_risk:
            results.append(pred.model_dump())
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"predictions": results, "count": len(results), "generated_at": datetime.utcnow().isoformat()}


@predictions_router.get("/node/{node_id}")
async def get_node_prediction(node_id: str):
    """Get prediction for a specific node."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    metrics = twin.node_metrics.get(node_id, {})
    affected = list(twin.get_downstream_nodes(node_id, depth=3))
    pred = get_predictor().predict(node_id, metrics, affected)
    if not pred:
        return {"node_id": node_id, "prediction": None, "message": "Risk below threshold"}
    return {"node_id": node_id, "prediction": pred.model_dump()}


# ──────────────────────────────────────────────────────
# BLAST RADIUS ROUTER
# ──────────────────────────────────────────────────────

blast_router = APIRouter(prefix="/api/blast-radius", tags=["Blast Radius"])


@blast_router.get("/{node_id}")
async def get_blast_radius(
    node_id: str,
    failure_type: IssueType = IssueType.MPLS_FAILURE,
):
    """Compute blast radius if node_id fails with given failure type."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    result = get_analyzer().analyze(node_id, failure_type)
    return result.model_dump()


@blast_router.get("")
async def get_blast_radius_all():
    """Compute blast radius for all critical nodes."""
    twin = get_twin()
    results = []
    critical_nodes = [
        nid for nid, data in twin.graph.nodes(data=True)
        if data.get("is_critical", False)
    ]
    for node_id in critical_nodes:
        result = get_analyzer().analyze(node_id, IssueType.MPLS_FAILURE)
        results.append(result.model_dump())
    results.sort(key=lambda x: x["impact_score"], reverse=True)
    return {"blast_radii": results}


# ──────────────────────────────────────────────────────
# SIMULATION ROUTER
# ──────────────────────────────────────────────────────

simulation_router = APIRouter(prefix="/api/simulation", tags=["Simulation"])


@simulation_router.post("")
async def run_simulation(
    node_id: str,
    failure_type: IssueType,
    current_risk: float = 75.0,
):
    """Run counterfactual simulation for all candidate actions."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    result = get_simulation_engine().simulate(
        trigger_node=node_id,
        failure_type=failure_type,
        current_risk=current_risk,
    )
    return result.model_dump()


@simulation_router.post("/action")
async def simulate_action(
    node_id: str,
    failure_type: IssueType,
    action_type: ActionType,
    current_risk: float = 75.0,
):
    """Simulate a single specific action."""
    action = SimulationAction(action_type=action_type, target_node=node_id)
    result = get_simulation_engine().simulate(
        trigger_node=node_id,
        failure_type=failure_type,
        current_risk=current_risk,
        specific_actions=[action],
    )
    return result.model_dump()


# ──────────────────────────────────────────────────────
# ACTION RANKING ROUTER
# ──────────────────────────────────────────────────────

actions_router = APIRouter(prefix="/api/actions", tags=["Actions"])


@actions_router.get("/{node_id}")
async def get_ranked_actions(
    node_id: str,
    issue_type: IssueType = IssueType.CONGESTION,
    current_risk: float = Query(default=70.0),
):
    """Get ranked corrective action plan for a node."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    plan = get_ranker().rank(node_id, issue_type, current_risk)
    return plan.model_dump()


# ──────────────────────────────────────────────────────
# COPILOT ROUTER
# ──────────────────────────────────────────────────────

copilot_router = APIRouter(prefix="/api/copilot", tags=["Copilot"])


@copilot_router.post("/query")
async def copilot_query(query: CopilotQuery):
    """Send a question to the AI copilot (non-streaming)."""
    twin = get_twin()
    # Build network context
    network_ctx = {
        "node_metrics": {
            nid: {k: v for k, v in m.items() if k != "risk_score"}
            for nid, m in twin.node_metrics.items()
        },
        "high_risk_nodes": [
            nid for nid, m in twin.node_metrics.items()
            if m.get("risk_score", 0) > 50
        ],
    }
    if query.context_node and query.context_node in twin.node_metrics:
        network_ctx["context_node_metrics"] = twin.node_metrics[query.context_node]

    copilot = get_copilot()
    response = await copilot.query(query, network_ctx)
    return response.model_dump()


@copilot_router.get("/stream")
async def copilot_stream(
    question: str,
    context_node: Optional[str] = None,
):
    """Stream copilot response (SSE format)."""
    copilot = get_copilot()

    async def generator():
        async for token in copilot.stream_query(question, context_node=context_node):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@copilot_router.get("/status")
async def copilot_status():
    """Check if Ollama is available."""
    copilot = get_copilot()
    available = await copilot.check_availability()
    return {
        "available": available,
        "model": copilot._model,
        "ollama_host": copilot._http.base_url if hasattr(copilot._http, 'base_url') else "unknown",
    }


# ──────────────────────────────────────────────────────
# RAG ROUTER
# ──────────────────────────────────────────────────────

rag_router = APIRouter(prefix="/api/rag", tags=["RAG"])


@rag_router.get("/search")
async def rag_search(q: str, top_k: int = 5):
    """Search knowledge base."""
    rag = get_rag()
    if not rag._initialized:
        rag.initialize()
    docs = rag.retrieve(q, top_k=top_k)
    return {"query": q, "results": docs, "count": len(docs)}


@rag_router.get("/stats")
async def rag_stats():
    """Return knowledge base statistics."""
    rag = get_rag()
    return rag.get_stats()


@rag_router.post("/index-runbooks")
async def index_runbooks():
    """Re-index all runbooks."""
    rag = get_rag()
    if not rag._initialized:
        rag.initialize()
    rag.index_all_runbooks()
    return {"status": "indexed", "stats": rag.get_stats()}


# ──────────────────────────────────────────────────────
# SCENARIOS ROUTER
# ──────────────────────────────────────────────────────

scenarios_router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])


@scenarios_router.get("")
async def list_scenarios():
    """List all available demo scenarios."""
    engine = get_fault_engine()
    return {
        "scenarios": [
            engine.get_scenario_info(s) for s in ScenarioType
        ]
    }


@scenarios_router.post("/{scenario_type}/inject")
async def inject_scenario(
    scenario_type: ScenarioType,
    step: Optional[int] = None,
):
    """Inject a fault scenario at a given severity step (0–4)."""
    engine = get_fault_engine()
    result = engine.inject_scenario(scenario_type, step)

    # Broadcast the topology change
    from core.websocket_manager import broadcast_scenario_update
    await broadcast_scenario_update(result)

    return result


@scenarios_router.post("/{scenario_type}/full")
async def inject_full_scenario(scenario_type: ScenarioType):
    """Inject scenario at maximum severity immediately (for demos)."""
    engine = get_fault_engine()
    result = engine.inject_full_scenario(scenario_type)

    from core.websocket_manager import broadcast_scenario_update
    await broadcast_scenario_update(result)

    return result


@scenarios_router.post("/reset")
async def reset_scenarios():
    """Reset all faults to baseline."""
    engine = get_fault_engine()
    engine.reset_all()
    from core.websocket_manager import broadcast_scenario_update
    await broadcast_scenario_update({"type": "reset", "message": "All faults cleared"})
    return {"status": "reset", "message": "All nodes restored to baseline"}


@scenarios_router.get("/{scenario_type}/analysis")
async def full_scenario_analysis(scenario_type: ScenarioType):
    """
    Complete scenario analysis: prediction + blast radius + actions + simulation.
    This is the 'full demo' endpoint used by the NOC dashboard.
    """
    config = SCENARIO_CONFIGS.get(scenario_type)
    if not config:
        raise HTTPException(404, f"Scenario {scenario_type} not found")

    trigger_node = config["trigger_node"]
    issue_type = config["issue_type"]
    current_risk = 82.0  # Assume high severity for demo

    # 1. Prediction
    twin = get_twin()
    metrics = twin.node_metrics.get(trigger_node, {})
    affected = list(twin.get_downstream_nodes(trigger_node, depth=4))
    prediction = get_predictor().predict(trigger_node, metrics, affected)

    # 2. Blast Radius
    blast = get_analyzer().analyze(trigger_node, issue_type)

    # 3. Ranked Actions
    plan = get_ranker().rank(trigger_node, issue_type, current_risk)

    # 4. Counterfactual Simulation
    simulation = get_simulation_engine().simulate(trigger_node, issue_type, current_risk)

    return {
        "scenario_type": scenario_type.value,
        "trigger_node": trigger_node,
        "issue_type": issue_type.value,
        "description": config["description"],
        "root_cause": config["root_cause"],
        "lead_time_minutes": config["lead_time_minutes"],
        "prediction": prediction.model_dump() if prediction else None,
        "blast_radius": blast.model_dump(),
        "action_plan": plan.model_dump(),
        "simulation": simulation.model_dump(),
        "generated_at": datetime.utcnow().isoformat(),
    }


# ──────────────────────────────────────────────────────
# GRAPH INTELLIGENCE ROUTER
# ──────────────────────────────────────────────────────

graph_router = APIRouter(prefix="/api/graph", tags=["Graph Intelligence"])


@graph_router.get("/centrality")
async def get_centrality():
    """Betweenness centrality ranking — identifies critical transit nodes."""
    return {"centrality": get_graph_engine().get_centrality_ranking()}


@graph_router.get("/service/{service}")
async def get_service_graph(service: str):
    """Service dependency graph for a named service (voip, erp, internet, etc.)."""
    return get_graph_engine().get_service_dependency_graph(service)


@graph_router.get("/redundancy")
async def get_redundancy():
    """Network redundancy analysis — SPOFs, edge/node connectivity."""
    return get_graph_engine().get_redundancy_analysis()


@graph_router.get("/mpls")
async def get_mpls_analysis():
    """MPLS LSP analysis — congestion and path health."""
    return get_graph_engine().get_mpls_path_analysis()


@graph_router.get("/propagation/{node_id}")
async def get_propagation(node_id: str):
    """Failure wave propagation model from a trigger node."""
    return get_graph_engine().get_impact_propagation_model(node_id)


@graph_router.get("/critical")
async def get_critical_nodes():
    """High-centrality + high-risk nodes — most dangerous in the network."""
    return {"critical_nodes": get_graph_engine().get_critical_infrastructure_nodes()}


# ──────────────────────────────────────────────────────
# TELEMETRY ROUTER
# ──────────────────────────────────────────────────────

telemetry_router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@telemetry_router.get("/current")
async def get_current_telemetry():
    """Return current metrics snapshot for all nodes."""
    return get_telemetry_service().get_current_metrics()


@telemetry_router.get("/node/{node_id}")
async def get_node_telemetry(node_id: str):
    """Return current metrics for a single node."""
    twin = get_twin()
    if node_id not in twin.graph.nodes:
        raise HTTPException(404, f"Node {node_id} not found")
    return {"node_id": node_id, "metrics": twin.node_metrics.get(node_id, {})}


# ──────────────────────────────────────────────────────
# WEBSOCKET
# ──────────────────────────────────────────────────────

ws_router = APIRouter(tags=["WebSocket"])


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time events.
    Events: risk_update, prediction, alert, topology_change, scenario_update.
    """
    await manager.connect(websocket)
    try:
        # Send initial state on connect
        twin = get_twin()
        topo = twin.get_topology()
        await manager.send_personal(websocket, "topology_init", {
            "nodes": [n.model_dump() for n in topo.nodes],
            "links": [l.model_dump() for l in topo.links],
        })
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong
            if data == "ping":
                await manager.send_personal(websocket, "pong", {"ts": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        await manager.disconnect(websocket)
