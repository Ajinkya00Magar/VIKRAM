/**
 * VIKRAM — client-side demo topology.
 *
 * Mirrors the backend digital-twin sample MPLS/SD-WAN network so the dashboard
 * (physics, risk engine, intrusions) is fully functional with no backend.
 */
import type { TopologyNode, TopologyLink, NodeType, NodeMetrics } from "@/store";

function metrics(over: Partial<NodeMetrics> = {}): NodeMetrics {
  return {
    cpu_utilization: 28,
    memory_utilization: 40,
    bandwidth_utilization: 32,
    packet_loss: 0.08,
    latency_ms: 7,
    jitter_ms: 0.9,
    error_rate: 0.01,
    qos_drop_rate: 0.1,
    risk_score: 0,
    ...over,
  };
}

interface Seed {
  id: string;
  label: string;
  type: NodeType;
  site: string;
  ip: string;
  x: number;
  y: number;
  critical: boolean;
  services: string[];
  over?: Partial<NodeMetrics>;
}

const SEEDS: Seed[] = [
  { id: "HUB-RTR-01",  label: "Hub Router 01",     type: "ROUTER",     site: "HQ",      ip: "10.0.0.1",  x: 500, y: 300, critical: true,  services: ["voip", "erp", "internet"] },
  { id: "MPLS-PE-01",  label: "MPLS PE Router 01", type: "PE",         site: "DC1",     ip: "10.0.1.1",  x: 300, y: 150, critical: true,  services: ["mpls-core"], over: { mpls_label_count: 4200 } },
  { id: "MPLS-PE-02",  label: "MPLS PE Router 02", type: "PE",         site: "DC2",     ip: "10.0.1.2",  x: 700, y: 150, critical: true,  services: ["mpls-core"], over: { mpls_label_count: 3900 } },
  { id: "SDWAN-CTRL",  label: "SD-WAN Controller", type: "SDWAN_CTRL", site: "HQ",      ip: "10.0.0.10", x: 500, y: 100, critical: true,  services: ["sdwan-mgmt"] },
  { id: "SPOKE-RTR-A", label: "Spoke Router A",    type: "ROUTER",     site: "SITE-A",  ip: "10.1.0.1",  x: 150, y: 450, critical: false, services: ["voip", "erp"],     over: { tunnel_uptime: 99.9 } },
  { id: "SPOKE-RTR-B", label: "Spoke Router B",    type: "ROUTER",     site: "SITE-B",  ip: "10.2.0.1",  x: 350, y: 500, critical: false, services: ["erp", "internet"], over: { tunnel_uptime: 99.8 } },
  { id: "SPOKE-RTR-C", label: "Spoke Router C",    type: "ROUTER",     site: "SITE-C",  ip: "10.3.0.1",  x: 650, y: 500, critical: false, services: ["voip", "video"],   over: { tunnel_uptime: 99.7 } },
  { id: "SPOKE-RTR-D", label: "Spoke Router D",    type: "ROUTER",     site: "SITE-D",  ip: "10.4.0.1",  x: 850, y: 450, critical: false, services: ["internet"],        over: { tunnel_uptime: 99.9 } },
  { id: "BGP-PEER-01", label: "BGP Internet Peer", type: "ROUTER",     site: "TRANSIT", ip: "203.0.1.1", x: 500, y: 30,  critical: true,  services: ["internet"],        over: { bgp_prefixes: 850000 } },
  { id: "SVC-VOIP",    label: "VoIP Service",      type: "SERVICE",    site: "HQ",      ip: "10.0.5.1",  x: 350, y: 350, critical: true,  services: ["voip"] },
  { id: "SVC-ERP",     label: "ERP Service",       type: "SERVICE",    site: "HQ",      ip: "10.0.5.2",  x: 500, y: 380, critical: true,  services: ["erp"] },
  { id: "SVC-VIDEO",   label: "Video Service",     type: "SERVICE",    site: "HQ",      ip: "10.0.5.3",  x: 650, y: 350, critical: false, services: ["video"] },
];

interface LinkSeed {
  id: string; src: string; dst: string; type: string; bw: number; mpls: boolean; tunnel?: string;
}

const LINK_SEEDS: LinkSeed[] = [
  { id: "L01", src: "HUB-RTR-01",  dst: "MPLS-PE-01",  type: "MPLS",     bw: 1000,  mpls: true },
  { id: "L02", src: "HUB-RTR-01",  dst: "MPLS-PE-02",  type: "MPLS",     bw: 1000,  mpls: true },
  { id: "L03", src: "MPLS-PE-01",  dst: "MPLS-PE-02",  type: "MPLS",     bw: 10000, mpls: true },
  { id: "L04", src: "MPLS-PE-01",  dst: "BGP-PEER-01", type: "BGP",      bw: 1000,  mpls: false },
  { id: "L05", src: "HUB-RTR-01",  dst: "SDWAN-CTRL",  type: "SDWAN",    bw: 100,   mpls: false },
  { id: "L06", src: "SPOKE-RTR-A", dst: "HUB-RTR-01",  type: "IPSEC",    bw: 100,   mpls: false, tunnel: "TUN-A-HUB" },
  { id: "L07", src: "SPOKE-RTR-A", dst: "MPLS-PE-01",  type: "MPLS",     bw: 100,   mpls: true },
  { id: "L08", src: "SPOKE-RTR-B", dst: "HUB-RTR-01",  type: "IPSEC",    bw: 200,   mpls: false, tunnel: "TUN-B-HUB" },
  { id: "L09", src: "SPOKE-RTR-B", dst: "MPLS-PE-01",  type: "MPLS",     bw: 200,   mpls: true },
  { id: "L10", src: "SPOKE-RTR-C", dst: "HUB-RTR-01",  type: "IPSEC",    bw: 200,   mpls: false, tunnel: "TUN-C-HUB" },
  { id: "L11", src: "SPOKE-RTR-C", dst: "MPLS-PE-02",  type: "MPLS",     bw: 200,   mpls: true },
  { id: "L12", src: "SPOKE-RTR-D", dst: "HUB-RTR-01",  type: "IPSEC",    bw: 100,   mpls: false, tunnel: "TUN-D-HUB" },
  { id: "L13", src: "SPOKE-RTR-D", dst: "MPLS-PE-02",  type: "MPLS",     bw: 100,   mpls: true },
  { id: "L14", src: "HUB-RTR-01",  dst: "SVC-VOIP",    type: "PHYSICAL", bw: 100,   mpls: false },
  { id: "L15", src: "HUB-RTR-01",  dst: "SVC-ERP",     type: "PHYSICAL", bw: 100,   mpls: false },
  { id: "L16", src: "HUB-RTR-01",  dst: "SVC-VIDEO",   type: "PHYSICAL", bw: 100,   mpls: false },
];

export function buildDemoTopology(): { nodes: TopologyNode[]; links: TopologyLink[] } {
  const nodes: TopologyNode[] = SEEDS.map((s) => ({
    node_id: s.id,
    label: s.label,
    node_type: s.type,
    site: s.site,
    ip_address: s.ip,
    position_x: s.x,
    position_y: s.y,
    risk_score: 0,
    risk_level: "HEALTHY",
    metrics: metrics(s.over),
    services: s.services,
    is_critical: s.critical,
  }));

  const links: TopologyLink[] = LINK_SEEDS.map((l) => ({
    link_id: l.id,
    source: l.src,
    target: l.dst,
    link_type: l.type,
    bandwidth_mbps: l.bw,
    utilization: 25 + Math.round((l.bw % 7) * 3),
    latency_ms: 6,
    packet_loss: 0.05,
    status: "UP",
    is_mpls: l.mpls,
    tunnel_id: l.tunnel,
  }));

  return { nodes, links };
}

/** Adjacency map for blast-radius propagation. */
export function buildAdjacency(links: TopologyLink[]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const l of links) {
    (adj[l.source] ??= []).push(l.target);
    (adj[l.target] ??= []).push(l.source);
  }
  return adj;
}
