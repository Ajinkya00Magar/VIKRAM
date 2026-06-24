/**
 * PS13 — Shared TypeScript Types
 * Extended types used across frontend components.
 */

export type IssueType =
  | "CONGESTION"
  | "LATENCY_DRIFT"
  | "ROUTE_INSTABILITY"
  | "TUNNEL_DEGRADATION"
  | "MPLS_FAILURE"
  | "POLICY_DRIFT"
  | "BGP_FLAP"
  | "LINK_DOWN";

export type ActionType =
  | "REROUTE_TRAFFIC"
  | "RESTART_TUNNEL"
  | "CHANGE_ROUTING_PREFERENCE"
  | "INCREASE_QOS_PRIORITY"
  | "FAILOVER_TO_BACKUP"
  | "CLEAR_BGP_SESSION"
  | "RESET_MPLS_PATH"
  | "APPLY_RATE_LIMIT"
  | "DO_NOTHING";

export type ScenarioType =
  | "HUB_CONGESTION"
  | "BGP_ROUTE_FLAP"
  | "TUNNEL_DEGRADATION"
  | "MPLS_FAILURE"
  | "POLICY_DRIFT";

export interface RankedAction {
  rank: number;
  action_type: ActionType;
  target_node: string;
  description: string;
  risk_reduction_pct: number;
  estimated_recovery_minutes: number;
  operational_cost: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  runbook_reference?: string;
  steps: string[];
}

export interface ActionPlan {
  trigger_node: string;
  issue_type: IssueType;
  ranked_actions: RankedAction[];
  generated_at: string;
}

export interface SimulationOutcome {
  action: { action_type: ActionType; target_node: string };
  projected_risk: number;
  risk_reduction_pct: number;
  estimated_recovery_minutes: number;
  side_effects: string[];
  confidence: number;
  description: string;
}

export interface SimulationResult {
  trigger_node: string;
  failure_type: IssueType;
  current_risk: number;
  do_nothing_outcome: SimulationOutcome;
  action_outcomes: SimulationOutcome[];
  recommended_action: { action_type: ActionType; target_node: string };
  future_state_projection: {
    timestamps_minutes: number[];
    do_nothing_risk_curve: number[];
    action_risk_curve: number[];
    best_action_label: string;
    sla_breach_threshold: number;
    time_to_sla_breach_without_action: number;
  };
  simulated_at: string;
}

export interface ScenarioAnalysis {
  scenario_type: ScenarioType;
  trigger_node: string;
  issue_type: IssueType;
  description: string;
  root_cause: string;
  lead_time_minutes: number;
  prediction: {
    prediction_id: string;
    confidence_score: number;
    risk_score: number;
    time_to_impact_minutes: number;
    affected_scope: string[];
    explanation: string;
  } | null;
  blast_radius: {
    affected_nodes: string[];
    affected_sites: string[];
    affected_services: string[];
    estimated_users_impacted: number;
    impact_score: number;
  };
  action_plan: ActionPlan;
  simulation: SimulationResult;
}

export interface RAGDocument {
  content: string;
  source: string;
  type: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface WebSocketMessage {
  event_type:
    | "topology_init"
    | "risk_update"
    | "prediction"
    | "alert"
    | "scenario_update"
    | "pong";
  payload: Record<string, unknown>;
  timestamp: string;
}
