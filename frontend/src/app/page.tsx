"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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

// Dynamic import keeps Three.js / WebGL fully client-side (no SSR)
const LandingIntro = dynamic(
  () => import("@/components/landing/LandingIntro"),
  { ssr: false }
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchInterval: 10_000 } },
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
function MissionControl() {
  const { connected } = useWebSocket();
  const { activePanel, setTopology } = usePS13Store();

  useEffect(() => {
    getTopology()
      .then((topo) => {
        if (topo?.nodes && topo?.links) setTopology(topo.nodes, topo.links);
      })
      .catch(console.error);
  }, [setTopology]);

  return (
    <div className="flex flex-col h-screen bg-void overflow-hidden mission-grid scan-lines">
      <MissionHeader connected={connected} />
      <AlertTicker />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 relative overflow-hidden">
          <NetworkCanvas />
          <RiskOverlay />
        </main>

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

// ── Root (landing gate + dashboard) ──────────────────────────────────────────
function AppRoot() {
  const [showLanding, setShowLanding] = useState(true);

  return (
    <>
      {/* Dashboard — always mounted so queries/WS warm up in background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showLanding ? 0 : 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        style={{ pointerEvents: showLanding ? "none" : "auto" }}
      >
        <MissionControl />
      </motion.div>

      {/* Landing intro — unmounts after exit animation */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
          >
            <LandingIntro onEnter={() => setShowLanding(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  );
}
