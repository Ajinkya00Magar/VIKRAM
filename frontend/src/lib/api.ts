/**
 * PS13 — API Client
 * Typed wrappers around all backend endpoints.
 */
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Topology ──────────────────────────────────────────

export const getTopology = () => api.get("/api/topology").then((r) => r.data);
export const getNode = (id: string) => api.get(`/api/topology/nodes/${id}`).then((r) => r.data);
export const getCentrality = () => api.get("/api/topology/centrality").then((r) => r.data);
export const getPaths = (src: string, dst: string) =>
  api.get(`/api/topology/paths`, { params: { src, dst } }).then((r) => r.data);

// ── Risk ──────────────────────────────────────────────

export const getSystemRisk = () => api.get("/api/risk").then((r) => r.data);
export const getNodeRisk = (id: string) => api.get(`/api/risk/node/${id}`).then((r) => r.data);
export const getRiskHistory = (id: string, hours = 1) =>
  api.get(`/api/risk/history/${id}`, { params: { hours } }).then((r) => r.data);

// ── Predictions ──────────────────────────────────────

export const getPredictions = (minRisk = 20) =>
  api.get("/api/predictions", { params: { min_risk: minRisk } }).then((r) => r.data);
export const getNodePrediction = (id: string) =>
  api.get(`/api/predictions/node/${id}`).then((r) => r.data);

// ── Blast Radius ──────────────────────────────────────

export const getBlastRadius = (nodeId: string, failureType = "MPLS_FAILURE") =>
  api.get(`/api/blast-radius/${nodeId}`, { params: { failure_type: failureType } }).then((r) => r.data);
export const getAllBlastRadii = () => api.get("/api/blast-radius").then((r) => r.data);

// ── Simulation ────────────────────────────────────────

export const runSimulation = (nodeId: string, failureType: string, currentRisk = 75) =>
  api
    .post("/api/simulation", null, {
      params: { node_id: nodeId, failure_type: failureType, current_risk: currentRisk },
    })
    .then((r) => r.data);

export const simulateAction = (
  nodeId: string, failureType: string, actionType: string, currentRisk = 75
) =>
  api
    .post("/api/simulation/action", null, {
      params: { node_id: nodeId, failure_type: failureType, action_type: actionType, current_risk: currentRisk },
    })
    .then((r) => r.data);

// ── Actions ───────────────────────────────────────────

export const getRankedActions = (nodeId: string, issueType: string, currentRisk = 70) =>
  api
    .get(`/api/actions/${nodeId}`, { params: { issue_type: issueType, current_risk: currentRisk } })
    .then((r) => r.data);

// ── Copilot ───────────────────────────────────────────

export const queryCopilot = (question: string, contextNode?: string) =>
  api
    .post("/api/copilot/query", { question, context_node: contextNode, include_rag: true })
    .then((r) => r.data);

export const getCopilotStatus = () => api.get("/api/copilot/status").then((r) => r.data);

export const streamCopilotUrl = (question: string, contextNode?: string) => {
  const params = new URLSearchParams({ question });
  if (contextNode) params.set("context_node", contextNode);
  return `${BASE}/api/copilot/stream?${params.toString()}`;
};

// ── RAG ───────────────────────────────────────────────

export const ragSearch = (q: string, topK = 5) =>
  api.get("/api/rag/search", { params: { q, top_k: topK } }).then((r) => r.data);

// ── Scenarios ─────────────────────────────────────────

export const listScenarios = () => api.get("/api/scenarios").then((r) => r.data);
export const injectScenario = (type: string, step?: number) =>
  api.post(`/api/scenarios/${type}/inject`, null, { params: step !== undefined ? { step } : {} }).then((r) => r.data);
export const injectFullScenario = (type: string) =>
  api.post(`/api/scenarios/${type}/full`).then((r) => r.data);
export const resetScenarios = () => api.post("/api/scenarios/reset").then((r) => r.data);
export const getScenarioAnalysis = (type: string) =>
  api.get(`/api/scenarios/${type}/analysis`).then((r) => r.data);

// ── Telemetry ─────────────────────────────────────────

export const getCurrentTelemetry = () => api.get("/api/telemetry/current").then((r) => r.data);
export const getNodeTelemetry = (id: string) =>
  api.get(`/api/telemetry/node/${id}`).then((r) => r.data);

// ── Health ────────────────────────────────────────────

export const getHealth = () => api.get("/health").then((r) => r.data);

export default api;
