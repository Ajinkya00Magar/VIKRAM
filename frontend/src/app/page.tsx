"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePS13Store } from "@/store";
import { getTopology } from "@/lib/api";
import MissionHeader from "@/components/layout/MissionHeader";
import Sidebar from "@/components/layout/Sidebar";
import NetworkCanvas from "@/components/network/NetworkCanvas";
import RiskOverlay from "@/components/risk/RiskOverlay";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import BlastRadiusPanel from "@/components/blast_radius/BlastRadiusPanel";
import SimulationPanel from "@/components/simulation/SimulationPanel";
import ScenarioPanel from "@/components/layout/ScenarioPanel";
import AlertTicker from "@/components/risk/AlertTicker";
import SystemStats from "@/components/charts/SystemStats";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchInterval: 10_000 } },
});

function MissionControl() {
  const { connected } = useWebSocket();
  const { activePanel, setTopology } = usePS13Store();

  // Initial topology load
  useEffect(() => {
    getTopology()
      .then((topo) => {
        if (topo?.nodes && topo?.links) {
          setTopology(topo.nodes, topo.links);
        }
      })
      .catch(console.error);
  }, [setTopology]);

  return (
    <div className="flex flex-col h-screen bg-void overflow-hidden mission-grid scan-lines">
      {/* ── Top Header Bar ── */}
      <MissionHeader connected={connected} />

      {/* ── Alert Ticker ── */}
      <AlertTicker />

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <Sidebar />

        {/* ── Center: Network Canvas (always visible) ── */}
        <main className="flex-1 relative overflow-hidden">
          <NetworkCanvas />
          <RiskOverlay />
        </main>

        {/* ── Right Panel: Context-sensitive ── */}
        <motion.aside
          key={activePanel}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-[420px] h-full overflow-hidden glass-panel border-l border-plasma/20 flex-shrink-0"
        >
          {activePanel === "copilot"    && <CopilotPanel />}
          {activePanel === "blast"      && <BlastRadiusPanel />}
          {activePanel === "simulation" && <SimulationPanel />}
          {activePanel === "scenarios"  && <ScenarioPanel />}
          {activePanel === "network"    && <SystemStats />}
        </motion.aside>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <MissionControl />
    </QueryClientProvider>
  );
}
