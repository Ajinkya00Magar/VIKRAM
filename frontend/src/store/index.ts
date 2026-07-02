/**
 * PS13 — Global Zustand Store
 * Single source of truth for all application state.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────

export type RiskLevel = "HEALTHY" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NodeType = "ROUTER" | "SITE" | "SERVICE" | "TUNNEL" | "PE" | "CE" | "SDWAN_CTRL";
export type LinkStatus = "UP" | "DOWN" | "DEGRADED";

export interface NodeMetrics {
  cpu_utilization: number;
  memory_utilization: number;
  bandwidth_utilization: number;
  packet_loss: number;
  latency_ms: number;
  jitter_ms: number;
  error_rate: number;
  qos_drop_rate: number;
  risk_score: number;
  bgp_prefixes?: number;
  mpls_label_count?: number;
  tunnel_uptime?: number;
}

export interface TopologyNode {
  node_id: string;
  label: string;
  node_type: NodeType;
  site?: string;
  ip_address?: string;
  position_x: number;
  position_y: number;
  risk_score: number;
  risk_level: RiskLevel;
  metrics: NodeMetrics;
  services: string[];
  is_critical: boolean;
}

export interface TopologyLink {
  link_id: string;
  source: string;
  target: string;
  link_type: string;
  bandwidth_mbps?: number;
  utilization: number;
  latency_ms: number;
  packet_loss: number;
  status: LinkStatus;
  is_mpls: boolean;
  tunnel_id?: string;
}

export interface Prediction {
  prediction_id: string;
  node_id: string;
  issue_type: string;
  confidence_score: number;
  risk_score: number;
  time_to_impact_minutes: number;
  affected_scope: string[];
  explanation: string;
  timestamp: string;
}

export interface RiskScore {
  node_id: string;
  risk_score: number;
  severity_score: number;
  escalation_level: number;
  urgency_level: RiskLevel;
  risk_factors: Record<string, number>;
  trend: "INCREASING" | "STABLE" | "DECREASING";
  calculated_at: string;
}

export interface Alert {
  id: string;
  node_id: string;
  risk_score: number;
  urgency: RiskLevel;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface BlastRadius {
  trigger_node: string;
  failure_type: string;
  affected_nodes: string[];
  affected_sites: string[];
  affected_services: string[];
  estimated_users_impacted: number;
  impact_score: number;
  propagation_depth: number;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  referenced_nodes: string[];
  referenced_runbooks: string[];
  timestamp: string;
  isStreaming?: boolean;
}

export interface ScenarioState {
  active: string | null;
  step: number;
  severity: string;
  trigger_node: string | null;
  description: string;
}

// One running intrusion. Multiple can be active concurrently.
export interface ScenarioInstance {
  type: string;          // e.g. "HUB_CONGESTION"
  trigger_node: string;  // node the intrusion originates at
  issue_type: string;    // e.g. "CONGESTION"
  step: number;          // 0..4 severity progression
  severity: RiskLevel;
  started_at: number;    // Date.now()
}

// Severity level by step index (0..4)
export const LEVELS: RiskLevel[] = ["HEALTHY", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ── Store ──────────────────────────────────────────────

interface PS13Store {
  // Topology
  nodes: TopologyNode[];
  links: TopologyLink[];
  selectedNode: TopologyNode | null;
  setTopology: (nodes: TopologyNode[], links: TopologyLink[]) => void;
  setNodes: (nodes: TopologyNode[]) => void;
  setSelectedNode: (node: TopologyNode | null) => void;
  updateNodeRisk: (nodeId: string, riskScore: number, riskLevel: RiskLevel) => void;
  updateNodeMetrics: (nodeId: string, metrics: Partial<NodeMetrics>) => void;

  // Risk
  systemRisk: number;
  highestRiskNode: string;
  criticalNodes: string[];
  nodeRiskScores: Record<string, RiskScore>;
  setSystemRisk: (risk: number, highest: string, critical: string[]) => void;
  setNodeRiskScore: (score: RiskScore) => void;

  // Predictions
  predictions: Prediction[];
  addPrediction: (pred: Prediction) => void;
  clearPredictions: () => void;

  // Alerts
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;

  // Blast Radius
  blastRadius: BlastRadius | null;
  setBlastRadius: (br: BlastRadius | null) => void;

  // Copilot
  copilotMessages: CopilotMessage[];
  addCopilotMessage: (msg: CopilotMessage) => void;
  updateLastCopilotMessage: (content: string, done?: boolean) => void;
  clearCopilot: () => void;
  highlightedNodes: string[];
  setHighlightedNodes: (nodes: string[]) => void;

  // Scenarios (legacy single — kept for header/back-compat)
  scenario: ScenarioState;
  setScenario: (s: Partial<ScenarioState>) => void;
  resetScenario: () => void;

  // Multiple concurrent intrusions
  activeScenarios: ScenarioInstance[];
  injectScenario: (s: ScenarioInstance) => void;      // add or escalate existing
  escalateScenario: (type: string) => void;
  clearScenario: (type: string) => void;
  clearAllScenarios: () => void;

  // Client-side simulation control
  simMode: boolean;                                    // true = front-end sim drives data
  setSimMode: (on: boolean) => void;

  // UI
  activePanel: "network" | "copilot" | "blast" | "simulation" | "scenarios";
  setActivePanel: (panel: PS13Store["activePanel"]) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  showLanding: boolean;
  setShowLanding: (show: boolean) => void;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const usePS13Store = create<PS13Store>()(
  subscribeWithSelector((set, get) => ({
    // Topology
    nodes: [],
    links: [],
    selectedNode: null,
    setTopology: (nodes, links) => set({ nodes, links }),
    setNodes: (nodes) => set({ nodes }),
    setSelectedNode: (node) => set({ selectedNode: node }),
    updateNodeRisk: (nodeId, riskScore, riskLevel) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.node_id === nodeId ? { ...n, risk_score: riskScore, risk_level: riskLevel } : n
        ),
      })),
    updateNodeMetrics: (nodeId, metrics) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.node_id === nodeId
            ? { ...n, metrics: { ...n.metrics, ...metrics } }
            : n
        ),
      })),

    // Risk
    systemRisk: 0,
    highestRiskNode: "",
    criticalNodes: [],
    nodeRiskScores: {},
    setSystemRisk: (risk, highest, critical) =>
      set({ systemRisk: risk, highestRiskNode: highest, criticalNodes: critical }),
    setNodeRiskScore: (score) =>
      set((state) => ({
        nodeRiskScores: { ...state.nodeRiskScores, [score.node_id]: score },
      })),

    // Predictions
    predictions: [],
    addPrediction: (pred) =>
      set((state) => ({
        predictions: [pred, ...state.predictions.filter((p) => p.node_id !== pred.node_id)].slice(0, 20),
      })),
    clearPredictions: () => set({ predictions: [] }),

    // Alerts
    alerts: [],
    addAlert: (alert) =>
      set((state) => ({
        alerts: [alert, ...state.alerts].slice(0, 50),
      })),
    acknowledgeAlert: (id) =>
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
      })),
    clearAlerts: () => set({ alerts: [] }),

    // Blast Radius
    blastRadius: null,
    setBlastRadius: (br) => set({ blastRadius: br }),

    // Copilot
    copilotMessages: [],
    addCopilotMessage: (msg) =>
      set((state) => ({ copilotMessages: [...state.copilotMessages, msg] })),
    updateLastCopilotMessage: (content, done = false) =>
      set((state) => {
        const msgs = [...state.copilotMessages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            content,
            isStreaming: !done,
          };
        }
        return { copilotMessages: msgs };
      }),
    clearCopilot: () => set({ copilotMessages: [] }),
    highlightedNodes: [],
    setHighlightedNodes: (nodes) => set({ highlightedNodes: nodes }),

    // Scenarios
    scenario: {
      active: null, step: 0, severity: "HEALTHY",
      trigger_node: null, description: "",
    },
    setScenario: (s) =>
      set((state) => ({ scenario: { ...state.scenario, ...s } })),
    resetScenario: () =>
      set({ scenario: { active: null, step: 0, severity: "HEALTHY", trigger_node: null, description: "" } }),

    // Multiple concurrent intrusions
    activeScenarios: [],
    injectScenario: (s) =>
      set((state) => {
        const existing = state.activeScenarios.find((a) => a.type === s.type);
        if (existing) {
          // Re-injecting an active scenario escalates its severity.
          return {
            activeScenarios: state.activeScenarios.map((a) =>
              a.type === s.type
                ? { ...a, step: Math.min(4, a.step + 1), severity: LEVELS[Math.min(4, a.step + 1)] }
                : a
            ),
          };
        }
        return { activeScenarios: [...state.activeScenarios, s] };
      }),
    escalateScenario: (type) =>
      set((state) => ({
        activeScenarios: state.activeScenarios.map((a) =>
          a.type === type
            ? { ...a, step: Math.min(4, a.step + 1), severity: LEVELS[Math.min(4, a.step + 1)] }
            : a
        ),
      })),
    clearScenario: (type) =>
      set((state) => ({
        activeScenarios: state.activeScenarios.filter((a) => a.type !== type),
      })),
    clearAllScenarios: () => set({ activeScenarios: [] }),

    // Client-side simulation
    simMode: false,
    setSimMode: (on) => set({ simMode: on }),

    // UI
    activePanel: "network",
    setActivePanel: (panel) => set({ activePanel: panel }),
    sidebarOpen: true,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    panelOpen: true,
    setPanelOpen: (open) => set({ panelOpen: open }),
    showLanding: true,
    setShowLanding: (show) => set({ showLanding: show }),
    wsConnected: false,
    setWsConnected: (connected) => set({ wsConnected: connected }),
  }))
);

// Risk color helpers
// Risk colours harmonised with the charcoal / starlight theme:
// calm teal → cool blue → soft amber → orange → muted rose (no neon red/green).
export function getRiskColor(level: RiskLevel | string): string {
  const map: Record<string, string> = {
    HEALTHY:  "#57b6a6",
    LOW:      "#7fb0d6",
    MEDIUM:   "#d8b062",
    HIGH:     "#dd8a4a",
    CRITICAL: "#e26370",
  };
  return map[level] ?? "#8b93a3";
}

export function getRiskGlow(level: RiskLevel | string): string {
  const map: Record<string, string> = {
    HEALTHY:  "0 0 12px rgba(87,182,166,0.5)",
    LOW:      "0 0 12px rgba(127,176,214,0.5)",
    MEDIUM:   "0 0 15px rgba(216,176,98,0.6)",
    HIGH:     "0 0 20px rgba(221,138,74,0.7)",
    CRITICAL: "0 0 25px rgba(226,99,112,0.8)",
  };
  return map[level] ?? "none";
}

export function scoreToLevel(score: number): RiskLevel {
  if (score < 20) return "HEALTHY";
  if (score < 40) return "LOW";
  if (score < 60) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "CRITICAL";
}
