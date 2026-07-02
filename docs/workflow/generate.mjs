/**
 * PS13 — Workflow Diagram Generator
 * Produces a 1920x1080 (16:9) vector SVG, an HTML print wrapper,
 * and (via headless Chrome/Edge) a single-page vector PDF for PPT/Canva.
 *
 * Run:  node docs/workflow/generate.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────── palette ─────────────────────────────
const C = {
  bg0: "#080a12",
  bg1: "#0f1320",
  bg2: "#151a2b",
  card: "#161b2b",
  cardEdge: "#283047",
  chip: "#1b2236",
  chipEdge: "#2c3650",
  ink: "#eef1fb",
  sub: "#9aa6c8",
  faint: "#6b76a0",
  teal: "#5eead4",
  mauve: "#c4a7f7",
  peach: "#fab387",
  pink: "#f38ba8",
  blue: "#7ca8fb",
  green: "#a6e3a1",
  sapphire: "#74c7ec",
  lavender: "#b4befe",
  gold: "#f9e2af",
};

// ───────────────────────────── geometry ─────────────────────────────
const W = 1920, H = 1080;

const ZL = 72;            // Left margin
const ZW = 254;           // Zone width
const GAP = 38;           // Gap between zones
const STEP = ZW + GAP;    // 292
const ZTOP = 196;         // Zones top
const ZH = 520;           // Zone height
const ZMID = ZTOP + 260;  // Flow arrows vertical center

const TIMELINE_T = 766;   // Timeline top
const TIMELINE_H = 106;   // Timeline height
const TIMELINE_B = TIMELINE_T + TIMELINE_H;

const zoneX = (i) => ZL + i * STEP;
const zoneCx = (i) => zoneX(i) + ZW / 2;

// ───────────────────────────── content ─────────────────────────────
const STAGES = [
  {
    no: "01", title: "Telemetry Polling", accent: C.teal, icon: "pulse",
    chips: [
      ["SNMP & NetFlow Poll", "Polled from routers every 5s"],
      ["Metric Capture", "CPU, latency, jitter, flaps"],
      ["Telegraf Pipeline", "Normalizes streams to DB"],
      ["InfluxDB Store", "Saves to local time-series"],
      ["Scenario Injector", "Triggers baseline anomalies"],
    ],
  },
  {
    no: "02", title: "Predictive ML Core", accent: C.mauve, icon: "net",
    chips: [
      ["Feature Eng.", "Creates rolling metric windows"],
      ["Isolation Forest", "Detects multi-metric anomalies"],
      ["Prophet", "Calculates Time-To-Impact"],
      ["XGBoost Classifier", "Categorizes failure causes"],
      ["Anomaly Fuser", "Synthesizes confidence score"],
    ],
  },
  {
    no: "03", title: "Graph Twin Mapping", accent: C.sapphire, icon: "target",
    chips: [
      ["Graph Sync", "Pushes risk scores to NetworkX"],
      ["BFS Traversal", "Traces paths from failing node"],
      ["Blast Radius", "Identifies impacted CE links"],
      ["Centrality Ranking", "Computes bottleneck scores"],
      ["State Broadcast", "Sends topology via WebSockets"],
    ],
  },
  {
    no: "04", title: "What-If Simulation", accent: C.peach, icon: "monitor",
    chips: [
      ["Option Extraction", "Fetches candidate runbooks"],
      ["Counterfactuals", "Simulates bypasses on twin"],
      ["Risk Curves", "Forecasts 60-min risk shift"],
      ["Cost-Aware Ranker", "Balances risk vs expense"],
      ["UI Decision Overlay", "Visualizes ranked solutions"],
    ],
  },
  {
    no: "05", title: "Grounded RAG", accent: C.pink, icon: "chat",
    chips: [
      ["Semantic Query", "Searches ChromaDB vector store"],
      ["Runbook Match", "Retrieves matched manual text"],
      ["Context Assembly", "Injects active telemetry stats"],
      ["Prompt Synthesis", "Formats zero-hallucination data"],
      ["Local Embeddings", "BGE-Small processes indices"],
    ],
  },
  {
    no: "06", title: "ARIA AI Execution", accent: C.blue, icon: "play",
    chips: [
      ["Ollama Inference", "Local Mistral-7B runs prompt"],
      ["SSE Streaming", "Streams replies to dashboard"],
      ["RCA Explanation", "Explains root-causes in English"],
      ["CLI Command Output", "Gives exact recovery syntax"],
      ["Control Feedback", "Operator approves and executes"],
    ],
  },
];

const FLOW = ["INGEST", "DIAGNOSE", "MAP", "SIMULATE", "GROUND"];

const TIMELINE_STEPS = [
  { phase: "INCEPTION", label: "Incident Occurs on Device" },
  { phase: "DETECTION", label: "Predictive Anomaly Flagged" },
  { phase: "TRIAGE", label: "Blast Radius Calculated" },
  { phase: "DECISION", label: "What-If Fixes Simulated" },
  { phase: "RETRIEVAL", label: "Context & Runbooks Fused" },
  { phase: "MITIGATION", label: "Copilot Guides Remediation" },
];

// ───────────────────────────── helpers ─────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(x, y, s, { size = 14, fill = C.ink, weight = 400, anchor = "start", spacing = 0, family = "Segoe UI, Inter, Arial, sans-serif", opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}">${esc(s)}</text>`;
}

function rrect(x, y, w, h, r, { fill = "none", stroke = "none", sw = 1, opacity = 1, dash = "", filter = "" } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" ${dash ? `stroke-dasharray="${dash}"` : ""} ${filter ? `filter="${filter}"` : ""}/>`;
}

// minimalist line icons inside 30x30 box at (x,y)
function icon(type, x, y, color) {
  const transform = `<g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
  let body = "";
  switch (type) {
    case "pulse":
      body = `<path d="M1 16 H8 L11 7 L16 25 L19 16 H29"/>`;
      break;
    case "net":
      body = `<circle cx="5" cy="6" r="3.2"/><circle cx="5" cy="24" r="3.2"/><circle cx="25" cy="15" r="3.6"/><path d="M8 7.5 L22 13.5 M8 22.5 L22 16.5"/>`;
      break;
    case "target":
      body = `<circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="6.5"/><circle cx="15" cy="15" r="1.6" fill="${color}"/>`;
      break;
    case "monitor":
      body = `<rect x="2" y="3" width="26" height="18" rx="2.5"/><path d="M11 26 H19 M15 21 V26"/><path d="M7 16 L11 11 L15 14 L19 8 L23 12" stroke-width="2"/>`;
      break;
    case "chat":
      body = `<path d="M3 6 H27 V20 H14 L8 26 V20 H3 Z"/><path d="M15 9 V17 M11 13 H19" stroke-width="2"/>`;
      break;
    case "play":
      body = `<path d="M6 4 L24 15 L6 26 Z" fill="${color}" stroke-width="1"/>`;
      break;
  }
  return transform + body + `</g>`;
}

// right-pointing arrow with gradient and label above
function flowArrow(i) {
  const x1 = zoneX(i) + ZW + 6;
  const x2 = zoneX(i + 1) - 6;
  const y = ZMID;
  const head = 12, hh = 7;
  const grad = `url(#flow${i})`;
  return `
    <g filter="url(#softGlow)">
      <line x1="${x1}" y1="${y}" x2="${x2 - head + 2}" y2="${y}" stroke="${grad}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M${x2 - head} ${y - hh} L${x2} ${y} L${x2 - head} ${y + hh} Z" fill="${grad}"/>
    </g>
    ${text((x1 + x2) / 2, y - 14, FLOW[i], { size: 10.5, fill: C.sub, weight: 800, anchor: "middle", spacing: 1.5 })}`;
}

// draws the card for a stage
function stageCard(s, i) {
  const x = zoneX(i), y = ZTOP, accent = s.accent;
  let res = "";
  // card base
  res += rrect(x, y, ZW, ZH, 18, { fill: "url(#cardFill)", stroke: C.cardEdge, sw: 1.4, filter: "url(#cardShadow)" });
  // top accent border
  res += `<rect x="${x}" y="${y}" width="${ZW}" height="6" rx="3" fill="${accent}" opacity="0.95"/>`;
  res += rrect(x, y, ZW, ZH, 18, { stroke: accent, sw: 1, opacity: 0.22 });
  
  // Header
  const hx = x + 16, hy = y + 30;
  res += `<g opacity="0.95">${icon(s.icon, hx, hy - 6, accent)}</g>`;
  res += text(hx + 38, hy + 2, s.no, { size: 12, fill: accent, weight: 800, spacing: 1 });
  res += text(hx + 38, hy + 22, s.title, { size: 16.5, fill: C.ink, weight: 700 });
  res += `<line x1="${x + 16}" y1="${y + 60}" x2="${x + ZW - 16}" y2="${y + 60}" stroke="${C.cardEdge}" stroke-width="1"/>`;
  
  // chips
  const chTop = y + 74, chH = 74, chGap = 10, chW = ZW - 32, chX = x + 16;
  s.chips.forEach(([t1, t2], k) => {
    const cy = chTop + k * (chH + chGap);
    res += rrect(chX, cy, chW, chH, 11, { fill: C.chip, stroke: C.chipEdge, sw: 1 });
    res += `<rect x="${chX}" y="${cy + 10}" width="3.5" height="${chH - 20}" rx="1.7" fill="${accent}" opacity="0.9"/>`;
    res += text(chX + 14, cy + 26, t1, { size: 13.5, fill: C.ink, weight: 650 });
    res += text(chX + 14, cy + 48, t2, { size: 11.5, fill: C.sub });
  });
  return res;
}

// ───────────────────────────── assemble svg ─────────────────────────────
let svg = "";

// definitions
svg += `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.bg0}"/><stop offset="0.5" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/>
  </linearGradient>
  <linearGradient id="cardFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a2032"/><stop offset="1" stop-color="#12172499"/>
  </linearGradient>
  <linearGradient id="spineFill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#16203a"/><stop offset="1" stop-color="#141a2c"/>
  </linearGradient>
  <linearGradient id="flow0" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.teal}"/><stop offset="1" stop-color="${C.mauve}"/></linearGradient>
  <linearGradient id="flow1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.sapphire}"/></linearGradient>
  <linearGradient id="flow2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.sapphire}"/><stop offset="1" stop-color="${C.peach}"/></linearGradient>
  <linearGradient id="flow3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.peach}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <linearGradient id="flow4" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
  <linearGradient id="titleAccent" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.teal}"/><stop offset="0.5" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.blue}"/>
  </linearGradient>
  <linearGradient id="feedbackGrad" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="${C.blue}"/><stop offset="0.5" stop-color="${C.lavender}"/><stop offset="1" stop-color="${C.teal}"/>
  </linearGradient>
  <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
  </filter>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#7ca8fb" flood-opacity="0.35"/>
  </filter>
</defs>`;

// background
svg += rrect(0, 0, W, H, 0, { fill: "url(#bg)" });

// grid dots
let dots = `<g fill="${C.faint}" opacity="0.06">`;
for (let gx = 40; gx < W; gx += 48) for (let gy = 40; gy < H; gy += 48) dots += `<circle cx="${gx}" cy="${gy}" r="1.3"/>`;
dots += `</g>`;
svg += dots;

// Title block
svg += text(72, 70, "NETRA-Twin — Closed-Loop Operational Workflow", { size: 38, fill: C.ink, weight: 800, spacing: 0.2 });
svg += `<rect x="74" y="84" width="680" height="4" rx="2" fill="url(#titleAccent)"/>`;
svg += text(72, 112, "Sequence of telemetry polling, predictive diagnostics, graph blast radius analysis, and AI-assisted remediation", { size: 16, fill: C.sub, weight: 500 });

// ISRO Context badge (top right)
const bw = 390, bx = W - 72 - bw, by = 44;
svg += rrect(bx, by, bw, 64, 14, { fill: "#10182a", stroke: C.lavender, sw: 1.3 });
svg += rrect(bx, by, bw, 64, 14, { fill: C.lavender, stroke: "none", opacity: 0.05 });
// satellite glyph
svg += `<g transform="translate(${bx + 20},${by + 16})" fill="none" stroke="${C.lavender}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 L2 12 M28 18 L18 28 M8 8 L22 22 M22 8 L8 22" stroke-dasharray="2 2"/>
  <rect x="10" y="10" width="10" height="10" rx="1" fill="${C.bg1}"/>
  <path d="M5 5 L10 10 M25 5 L20 10 M5 25 L10 20 M25 25 L20 20"/>
</g>`;
svg += text(bx + 64, by + 28, "ISTRAC MISSION OPERATIONS ALIGNED", { size: 14, fill: C.lavender, weight: 800, spacing: 0.6 });
svg += text(bx + 64, by + 48, "Modeled after satellite telemetry health diagnostic loops", { size: 11.5, fill: C.sub });

// Secure perimeter
const PB = { x: 48, y: 132, w: W - 96, h: 864 };
svg += rrect(PB.x, PB.y, PB.w, PB.h, 22, { stroke: C.cardEdge, sw: 1.6, dash: "2 9", opacity: 0.8 });
svg += text(PB.x + 22, PB.y + 26, "SECURE PERIMETER (AIR-GAPPED SYSTEM)", { size: 11.5, fill: C.faint, weight: 700, spacing: 2 });
for (const [cx, cy] of [[PB.x, PB.y], [PB.x + PB.w, PB.y], [PB.x, PB.y + PB.h], [PB.x + PB.w, PB.y + PB.h]]) {
  svg += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${C.sapphire}" opacity="0.7"/>`;
}

// Render cards and arrows
STAGES.forEach((s, i) => { svg += stageCard(s, i); });
for (let i = 0; i < 5; i++) svg += flowArrow(i);

// ── Chronology Timeline Band ──
const totalW = ZW * 6 + GAP * 5; // 1786
svg += rrect(ZL, TIMELINE_T, totalW, TIMELINE_H, 16, { fill: "url(#spineFill)", stroke: C.cardEdge, sw: 1.2 });
svg += rrect(ZL, TIMELINE_T, totalW, TIMELINE_H, 16, { fill: C.sapphire, opacity: 0.03 });

// Timeline details
const lineY = TIMELINE_T + 40;
svg += `<line x1="${ZL + 60}" y1="${lineY}" x2="${ZL + totalW - 60}" y2="${lineY}" stroke="${C.chipEdge}" stroke-width="3"/>`;

TIMELINE_STEPS.forEach((step, i) => {
  const cx = zoneCx(i);
  const color = STAGES[i].accent;
  // Node dot
  svg += `<circle cx="${cx}" cy="${lineY}" r="7" fill="${color}" stroke="${C.bg0}" stroke-width="2.5" filter="url(#softGlow)"/>`;
  // labels
  svg += text(cx, lineY + 24, step.phase, { size: 11.5, fill: color, weight: 800, anchor: "middle", spacing: 1 });
  svg += text(cx, lineY + 44, step.label, { size: 11.5, fill: C.sub, anchor: "middle" });
});

// ── Remediation Closed Feedback Loop (Arrow going back) ──
const loopY = TIMELINE_B + 28;
const startX = zoneCx(5); // Stage 6
const endX = zoneCx(0);   // Stage 1
svg += `
  <g opacity="0.85">
    <!-- Vertically down from Stage 6 -->
    <path d="M${startX} ${TIMELINE_B} L${startX} ${loopY} a10 10 0 0 1 -10 10 L${endX + 10} ${loopY + 10} a10 10 0 0 1 -10 -10 L${endX} ${ZTOP + ZH}" 
          fill="none" stroke="url(#feedbackGrad)" stroke-width="3" stroke-dasharray="5 5"/>
    <!-- Arrowhead at the end (pointing back to router state) -->
    <path d="M${endX - 5} ${ZTOP + ZH + 12} L${endX} ${ZTOP + ZH + 2} L${endX + 5} ${ZTOP + ZH + 12} Z" fill="${C.teal}"/>
  </g>
`;
svg += text((startX + endX) / 2, loopY + 4, "REMEDIATION CONTROL SIGNAL (AUTOMATED OR OPERATOR CONFIRMED SYSTEM HEALING)", { size: 11.5, fill: C.sub, weight: 700, anchor: "middle", spacing: 1.5 });

// Footer
const fy = TIMELINE_B + 68;
svg += text(72, fy, "Process Engine:", { size: 13, fill: C.faint, weight: 700 });
svg += text(192, fy, "Real-time Telemetry Ingestion (5s) → Predictive Machine Learning → Digital Twin Graphs (NetworkX) → What-If Simulation → Grounded RAG Contextualization → ARIA Copilot", { size: 13, fill: C.sub });

// Wrap
const svgDoc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`;

// ───────────────────────────── write files ─────────────────────────────
const targetDir = join(__dirname);
const svgPath = join(targetDir, "ps13-workflow.svg");
const htmlPath = join(targetDir, "ps13-workflow.html");
const pdfPath = join(targetDir, "ps13-workflow.pdf");

writeFileSync(svgPath, svgDoc, "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: ${W / 96}in ${H / 96}in; margin: 0; }
  html,body { margin:0; padding:0; background:${C.bg0}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  svg { display:block; width:${W}px; height:${H}px; }
</style></head><body>${svgDoc}</body></html>`;
writeFileSync(htmlPath, html, "utf8");

console.log("SVG generated :", svgPath);
console.log("HTML generated:", htmlPath);

// ───────────────────────────── render PDF ─────────────────────────────
const chromes = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
let rendered = false;
for (const exe of chromes) {
  try {
    execFileSync(exe, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file:///${htmlPath.replace(/\\/g, "/")}`,
    ], { stdio: "ignore", timeout: 120000 });
    rendered = true;
    console.log("PDF generated :", pdfPath, "(via", exe.split("/").pop() + ")");
    break;
  } catch (e) {
    // try next browser
  }
}
if (!rendered) console.log("PDF render skipped (no headless browser succeeded).");
