/**
 * VIKRAM — client-side simulation engine.
 *
 * When no live backend WebSocket is present, this seeds the demo topology and
 * runs a tick loop that turns the active intrusions into per-node risk, system
 * risk, predictions and alerts. Supports multiple concurrent intrusions and
 * decays back to healthy when they are cleared.
 *
 * It steps aside automatically if a real backend WebSocket connects.
 */
"use client";

import { useEffect, useRef } from "react";
import { usePS13Store, scoreToLevel, type RiskLevel, type TopologyNode, type RiskScore } from "@/store";
import { buildDemoTopology, buildAdjacency } from "@/lib/demoTopology";
import { STEP_RISK } from "@/lib/scenarios";

const TICK_MS = 900;
const HOP1 = 0.5; // neighbour risk falloff (1 hop)
const HOP2 = 0.22; // 2 hops
const EASE = 0.28; // how fast live risk approaches its target each tick

export function useSimulation() {
  const startedRef = useRef(false);
  const riskRef = useRef<Record<string, number>>({}); // eased live risk per node
  const prevLevelRef = useRef<Record<string, RiskLevel>>({});
  const noiseRef = useRef(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let bootTimer: ReturnType<typeof setTimeout> | null = null;

    function boot() {
      const s = usePS13Store.getState();
      if (startedRef.current) return;
      startedRef.current = true;

      // Client sim owns risk & intrusions so multiple concurrent intrusions
      // aggregate correctly. Topology is taken from the backend if it arrived,
      // otherwise the built-in demo network is seeded.
      s.setSimMode(true);
      if (s.nodes.length === 0) {
        const { nodes, links } = buildDemoTopology();
        s.setTopology(nodes, links);
      }
      interval = setInterval(tick, TICK_MS);
      tick();
    }

    function tick() {
      const s = usePS13Store.getState();
      const nodes = s.nodes;
      if (!nodes.length) return;

      const adj = buildAdjacency(s.links);
      const nodeById: Record<string, TopologyNode> = {};
      nodes.forEach((n) => (nodeById[n.node_id] = n));

      // ── Target risk from all active intrusions (with blast-radius falloff) ──
      const target: Record<string, number> = {};
      nodes.forEach((n) => (target[n.node_id] = 0));

      for (const sc of s.activeScenarios) {
        const base = STEP_RISK[Math.max(0, Math.min(4, sc.step))];
        const t = sc.trigger_node;
        if (target[t] === undefined) continue;
        target[t] = Math.min(100, target[t] + base);

        const hop1 = adj[t] ?? [];
        for (const n1 of hop1) {
          target[n1] = Math.min(100, (target[n1] ?? 0) + base * HOP1);
          for (const n2 of adj[n1] ?? []) {
            if (n2 === t || hop1.includes(n2)) continue;
            target[n2] = Math.min(100, (target[n2] ?? 0) + base * HOP2);
          }
        }
      }

      noiseRef.current += 1;
      const wobble = Math.sin(noiseRef.current * 0.7) * 1.4;

      // ── Ease live risk toward target, rebuild node objects ─────────────────
      let maxRisk = 0;
      let maxNode = "";
      let sum = 0;
      const critical: string[] = [];
      const scores: Record<string, RiskScore> = {};

      const nextNodes: TopologyNode[] = nodes.map((n) => {
        const prev = riskRef.current[n.node_id] ?? n.risk_score ?? 0;
        const tgt = target[n.node_id] ?? 0;
        let live = prev + (tgt - prev) * EASE;
        // small idle shimmer only where there is some risk
        if (live > 2) live = Math.max(0, Math.min(100, live + wobble));
        if (live < 0.4) live = 0;
        riskRef.current[n.node_id] = live;

        const level = scoreToLevel(live);
        if (live > maxRisk) { maxRisk = live; maxNode = n.node_id; }
        sum += live;
        if (level === "CRITICAL") critical.push(n.node_id);

        // Metrics scale with live risk (bounded, plausible).
        const r = live / 100;
        const m = n.metrics;
        const metrics = {
          ...m,
          cpu_utilization: clamp(26 + r * 62 + wobble, 5, 99),
          bandwidth_utilization: clamp(30 + r * 60 + wobble, 5, 99),
          packet_loss: clamp(0.05 + r * r * 9, 0, 18),
          latency_ms: clamp(6 + r * 120, 3, 400),
          jitter_ms: clamp(0.8 + r * 22, 0.2, 60),
          error_rate: clamp(0.01 + r * 5, 0, 12),
          qos_drop_rate: clamp(0.1 + r * 30, 0, 60),
          risk_score: live,
        };

        // Emit an alert when a node newly crosses into HIGH / CRITICAL.
        const prevLevel = prevLevelRef.current[n.node_id] ?? "HEALTHY";
        if (
          (level === "HIGH" || level === "CRITICAL") &&
          level !== prevLevel &&
          rank(level) > rank(prevLevel)
        ) {
          s.addAlert({
            id: `alert-${n.node_id}-${Math.round(live)}-${noiseRef.current}`,
            node_id: n.node_id,
            risk_score: live,
            urgency: level,
            message: `${n.node_id} risk ${level} (${live.toFixed(0)})`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          });
        }
        // Feed the risk-ranking overlay. `prev` is last tick's eased risk.
        if (live > 1) {
          scores[n.node_id] = {
            node_id: n.node_id,
            risk_score: live,
            severity_score: live,
            escalation_level: rank(level),
            urgency_level: level,
            risk_factors: {},
            trend: live > prev + 0.6 ? "INCREASING" : live < prev - 0.6 ? "DECREASING" : "STABLE",
            calculated_at: new Date().toISOString(),
          };
        }
        prevLevelRef.current[n.node_id] = level;

        return { ...n, risk_score: live, risk_level: level, metrics };
      });

      s.setNodes(nextNodes);
      usePS13Store.setState({ nodeRiskScores: scores });

      const mean = sum / nextNodes.length;
      const systemRisk = Math.min(100, maxRisk * 0.6 + mean * 0.9);
      s.setSystemRisk(systemRisk, maxNode, critical);

      // ── Predictions for escalating intrusions ─────────────────────────────
      for (const sc of s.activeScenarios) {
        if (sc.step < 1) continue;
        const conf = Math.min(0.98, 0.4 + sc.step * 0.14);
        s.addPrediction({
          prediction_id: `pred-${sc.type}`,
          node_id: sc.trigger_node,
          issue_type: sc.issue_type,
          confidence_score: conf,
          risk_score: riskRef.current[sc.trigger_node] ?? 0,
          time_to_impact_minutes: Math.max(1, 30 - sc.step * 7),
          affected_scope: adj[sc.trigger_node] ?? [],
          explanation: `${sc.type.replace(/_/g, " ")} escalating at ${sc.trigger_node}.`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Give a real backend a moment to connect before simulating.
    bootTimer = setTimeout(boot, 1500);

    return () => {
      if (interval) clearInterval(interval);
      if (bootTimer) clearTimeout(bootTimer);
    };
  }, []);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function rank(l: RiskLevel): number {
  return ["HEALTHY", "LOW", "MEDIUM", "HIGH", "CRITICAL"].indexOf(l);
}
