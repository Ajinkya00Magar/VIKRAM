"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  type Node, type Edge, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import * as d3 from "d3";
import { usePS13Store, getRiskColor } from "@/store";
import NetworkNode from "./NetworkNode";
import NetworkEdge from "./NetworkEdge";

const nodeTypes = { networkNode: NetworkNode };
const edgeTypes = { networkEdge: NetworkEdge };

// d3 simulation node (mutated in place by the force sim)
interface SimNode {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export default function NetworkCanvas() {
  const { nodes: storeNodes, links: storeLinks, selectedNode, setSelectedNode } = usePS13Store();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const simRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());
  const draggingRef = useRef<string | null>(null);

  // Rebuild the simulation only when the SET of nodes/links changes
  // (not on every risk tick), so physics positions are preserved.
  const nodeIdKey = useMemo(
    () => storeNodes.map((n) => n.node_id).sort().join(","),
    [storeNodes]
  );
  const linkIdKey = useMemo(
    () => storeLinks.map((l) => l.link_id).sort().join(","),
    [storeLinks]
  );

  useEffect(() => {
    if (!storeNodes.length) return;

    const prev = simNodesRef.current;
    // Preserve existing positions; seed new nodes from their layout coords.
    const simNodes: SimNode[] = storeNodes.map((n, i) => {
      const ex = prev.get(n.node_id);
      if (ex) return ex;
      const spread = (v: number, c: number) => (v - c) * 0.9 + (i % 2 ? 12 : -12);
      return { id: n.node_id, x: spread(n.position_x, 500), y: spread(n.position_y, 300) };
    });
    const map = new Map(simNodes.map((sn) => [sn.id, sn]));
    simNodesRef.current = map;

    const simLinks = storeLinks
      .filter((l) => map.has(l.source) && map.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));

    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force("charge", d3.forceManyBody<SimNode>().strength(-540))
      .force(
        "link",
        d3
          .forceLink<SimNode, { source: string; target: string }>(simLinks)
          .id((d) => d.id)
          .distance(135)
          .strength(0.32)
      )
      .force("collide", d3.forceCollide<SimNode>(60))
      .force("x", d3.forceX<SimNode>(0).strength(0.045))
      .force("y", d3.forceY<SimNode>(0).strength(0.05))
      .velocityDecay(0.42)
      .alphaTarget(0.02) // never fully settle → gentle perpetual motion
      .alphaDecay(0.02);

    sim.on("tick", () => {
      setRfNodes((nds) =>
        nds.map((rn) => {
          if (draggingRef.current === rn.id) return rn;
          const sn = map.get(rn.id);
          if (!sn) return rn;
          return { ...rn, position: { x: sn.x, y: sn.y } };
        })
      );
    });

    simRef.current = sim;

    // Seed React Flow nodes at their current sim positions.
    setRfNodes(
      storeNodes.map((n) => {
        const sn = map.get(n.node_id)!;
        return {
          id: n.node_id,
          type: "networkNode",
          position: { x: sn.x, y: sn.y },
          data: { node: n, selected: selectedNode?.node_id === n.node_id },
          draggable: true,
        };
      })
    );

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdKey, linkIdKey, setRfNodes]);

  // Update node DATA (risk/metrics) without disturbing physics positions.
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((rn) => {
        const sn = storeNodes.find((s) => s.node_id === rn.id);
        if (!sn) return rn;
        return {
          ...rn,
          data: { ...rn.data, node: sn, selected: selectedNode?.node_id === rn.id },
        };
      })
    );
  }, [storeNodes, selectedNode, setRfNodes]);

  // Build edges from links.
  useEffect(() => {
    if (!storeLinks.length) return;
    const flowEdges: Edge[] = storeLinks.map((l) => {
      const utilColor =
        l.status === "DOWN" ? "#e26370" :
        l.packet_loss > 2  ? "#e26370" :
        l.utilization > 80 ? "#dd8a4a" :
        l.utilization > 60 ? "#d8b062" :
        "#8fb4ff";

      return {
        id: l.link_id,
        source: l.source,
        target: l.target,
        type: "networkEdge",
        animated: l.utilization > 50 || l.status === "DEGRADED",
        data: { link: l, color: utilColor },
        style: { stroke: utilColor, strokeWidth: l.is_mpls ? 2.5 : 1.5, opacity: l.status === "DOWN" ? 0.3 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: utilColor, width: 8, height: 8 },
      };
    });
    setRfEdges(flowEdges);
  }, [storeLinks, setRfEdges]);

  // ── Drag: pin node to the pointer, reheat sim, release on drop ───────────
  const onNodeDragStart = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    draggingRef.current = node.id;
    const sn = simNodesRef.current.get(node.id);
    if (sn) { sn.fx = node.position.x; sn.fy = node.position.y; }
    simRef.current?.alphaTarget(0.35).restart();
  }, []);

  const onNodeDrag = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    const sn = simNodesRef.current.get(node.id);
    if (sn) { sn.fx = node.position.x; sn.fy = node.position.y; }
  }, []);

  const onNodeDragStop = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    draggingRef.current = null;
    const sn = simNodesRef.current.get(node.id);
    if (sn) { sn.fx = null; sn.fy = null; } // rejoin the physics
    simRef.current?.alphaTarget(0.02);
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const storeNode = storeNodes.find((n) => n.node_id === node.id);
      setSelectedNode(storeNode ?? null);
    },
    [storeNodes, setSelectedNode]
  );

  const onPaneClick = useCallback(() => setSelectedNode(null), [setSelectedNode]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={3}
        className="w-full h-full"
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(143,180,255,0.10)"
          gap={30}
          size={1}
        />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            const sn = storeNodes.find((s) => s.node_id === n.id);
            return sn ? getRiskColor(sn.risk_level) : "#8b93a3";
          }}
          maskColor="rgba(10,11,14,0.7)"
          className="!bottom-4 !right-4 !w-36 !h-24"
        />
      </ReactFlow>

      {/* Empty state */}
      {storeNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="text-center"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-white/20 text-sm font-mono mb-2">Initialising network topology…</div>
            <div className="text-white/10 text-xs font-mono">Spinning up digital twin</div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
