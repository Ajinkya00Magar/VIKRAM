/**
 * PS13 — React Query Hooks
 * Typed data fetching hooks with auto-refresh for all API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTopology, getSystemRisk, getPredictions, getAllBlastRadii,
  listScenarios, getCurrentTelemetry, getScenarioAnalysis,
  getRankedActions, runSimulation, getHealth, ragSearch,
} from "@/lib/api";

// ── Query Keys ────────────────────────────────────────────────
export const QK = {
  TOPOLOGY:      ["topology"],
  RISK:          ["risk"],
  PREDICTIONS:   ["predictions"],
  BLAST:         ["blast-radius"],
  TELEMETRY:     ["telemetry"],
  SCENARIOS:     ["scenarios"],
  HEALTH:        ["health"],
  ACTIONS:       (node: string, issue: string) => ["actions", node, issue],
  SIMULATION:    (node: string, failure: string) => ["simulation", node, failure],
  SCENARIO_ANALYSIS: (type: string) => ["scenario-analysis", type],
} as const;

// ── Topology ──────────────────────────────────────────────────
export function useTopology() {
  return useQuery({
    queryKey: QK.TOPOLOGY,
    queryFn: getTopology,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

// ── System Risk ───────────────────────────────────────────────
export function useSystemRisk() {
  return useQuery({
    queryKey: QK.RISK,
    queryFn: getSystemRisk,
    refetchInterval: 8_000,
    staleTime: 5_000,
  });
}

// ── Predictions ───────────────────────────────────────────────
export function usePredictions(minRisk = 20) {
  return useQuery({
    queryKey: [...QK.PREDICTIONS, minRisk],
    queryFn: () => getPredictions(minRisk),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

// ── Blast Radii ───────────────────────────────────────────────
export function useAllBlastRadii() {
  return useQuery({
    queryKey: QK.BLAST,
    queryFn: getAllBlastRadii,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });
}

// ── Telemetry ─────────────────────────────────────────────────
export function useTelemetry() {
  return useQuery({
    queryKey: QK.TELEMETRY,
    queryFn: getCurrentTelemetry,
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

// ── Scenarios ─────────────────────────────────────────────────
export function useScenarios() {
  return useQuery({
    queryKey: QK.SCENARIOS,
    queryFn: listScenarios,
    staleTime: Infinity,
  });
}

export function useScenarioAnalysis(scenarioType: string | null) {
  return useQuery({
    queryKey: QK.SCENARIO_ANALYSIS(scenarioType ?? ""),
    queryFn: () => getScenarioAnalysis(scenarioType!),
    enabled: !!scenarioType,
    staleTime: 30_000,
  });
}

// ── Actions ───────────────────────────────────────────────────
export function useRankedActions(
  nodeId: string | null, issueType: string, currentRisk = 70
) {
  return useQuery({
    queryKey: QK.ACTIONS(nodeId ?? "", issueType),
    queryFn: () => getRankedActions(nodeId!, issueType, currentRisk),
    enabled: !!nodeId,
    staleTime: 30_000,
  });
}

// ── Simulation ────────────────────────────────────────────────
export function useSimulation(nodeId: string | null, failureType: string, currentRisk = 75) {
  return useQuery({
    queryKey: QK.SIMULATION(nodeId ?? "", failureType),
    queryFn: () => runSimulation(nodeId!, failureType, currentRisk),
    enabled: !!nodeId,
    staleTime: 20_000,
  });
}

// ── Health ────────────────────────────────────────────────────
export function useHealth() {
  return useQuery({
    queryKey: QK.HEALTH,
    queryFn: getHealth,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

// ── RAG Search ────────────────────────────────────────────────
export function useRAGSearch(query: string) {
  return useQuery({
    queryKey: ["rag", query],
    queryFn: () => ragSearch(query),
    enabled: query.length > 3,
    staleTime: 60_000,
  });
}
