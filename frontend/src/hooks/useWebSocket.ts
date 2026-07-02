/**
 * PS13 — WebSocket Hook
 * Connects to backend WS and routes events to Zustand store.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePS13Store, RiskLevel, scoreToLevel } from "@/store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  ? `${process.env.NEXT_PUBLIC_WS_URL.replace("http", "ws")}/ws`
  : "ws://localhost:8000/ws";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const wsConnected = usePS13Store((state) => state.wsConnected);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      const { event_type, payload } = msg;
      const state = usePS13Store.getState();

      // When the client simulation owns risk/intrusions, ignore the backend's
      // live risk/prediction/alert/scenario streams (topology is still used).
      const simOwnsRisk = state.simMode;

      switch (event_type) {
        case "topology_init": {
          state.setTopology(payload.nodes || [], payload.links || []);
          break;
        }

        case "risk_update": {
          if (simOwnsRisk) break;
          state.setSystemRisk(
            payload.overall_risk ?? 0,
            payload.highest_risk_node ?? "",
            payload.critical_nodes ?? []
          );
          // Update per-node risk
          for (const ns of payload.node_scores ?? []) {
            state.updateNodeRisk(
              ns.node_id,
              ns.risk_score,
              ns.urgency_level as RiskLevel
            );
            state.setNodeRiskScore({
              node_id: ns.node_id,
              risk_score: ns.risk_score,
              severity_score: ns.risk_score,
              escalation_level: ns.escalation_level,
              urgency_level: ns.urgency_level,
              risk_factors: {},
              trend: ns.trend,
              calculated_at: payload.calculated_at,
            });
          }
          break;
        }

        case "prediction": {
          if (simOwnsRisk) break;
          state.addPrediction({
            prediction_id: payload.prediction_id,
            node_id: payload.node_id,
            issue_type: payload.issue_type,
            confidence_score: payload.confidence_score,
            risk_score: payload.risk_score,
            time_to_impact_minutes: payload.time_to_impact_minutes,
            affected_scope: payload.affected_scope ?? [],
            explanation: payload.explanation ?? "",
            timestamp: payload.timestamp,
          });
          break;
        }

        case "alert": {
          if (simOwnsRisk) break;
          state.addAlert({
            id: `alert-${Date.now()}`,
            node_id: payload.node_id,
            risk_score: payload.risk_score,
            urgency: payload.urgency as RiskLevel,
            message: payload.message,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          });
          break;
        }

        case "scenario_update": {
          if (payload.type === "reset") {
            state.resetScenario();
          } else {
            state.setScenario({
              active: payload.scenario,
              step: payload.step ?? 0,
              severity: payload.severity ?? "HEALTHY",
              trigger_node: payload.trigger_node ?? null,
              description: payload.description ?? "",
            });
          }
          break;
        }

        case "pong":
          break;

        default:
          break;
      }
    } catch (e) {
      console.warn("WS parse error:", e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      usePS13Store.getState().setWsConnected(true);
      console.log("🔌 PS13 WebSocket connected");
      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        else clearInterval(heartbeat);
      }, 30_000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      usePS13Store.getState().setWsConnected(false);
      console.warn("WS disconnected, reconnecting in 3s...");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = (e) => {
      console.error("WS error", e);
      ws.close();
    };
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    connected: wsConnected,
    send: (data: string) => wsRef.current?.send(data),
  };
}
