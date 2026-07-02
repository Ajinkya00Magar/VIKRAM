/**
 * PS13 — Architecture Diagram Generator
 * Produces a 1920x1080 (16:9) vector SVG, an HTML print wrapper,
 * and (via headless Chrome) a single-page vector PDF for Canva/PPT.
 *
 * Run:  node docs/architecture/generate.mjs
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

const ZL = 72;            // zone band left
const ZW = 309;           // zone width
const GAP = 56;           // gap between zones
const STEP = ZW + GAP;    // 365
const ZTOP = 196;         // zones top
const ZH = 416;           // zone height
const ZMID = ZTOP + 192;  // arrow mid-line (a touch above center, clear of chips)

const SPINE_T = 640, SPINE_H = 92, SPINE_B = SPINE_T + SPINE_H;
const DATA_T = 760, DATA_H = 150, DATA_B = DATA_T + DATA_H;

const zoneX = (i) => ZL + i * STEP;
const zoneCx = (i) => zoneX(i) + ZW / 2;

// ───────────────────────────── content ─────────────────────────────
const ZONES = [
  {
    no: "01", title: "Telemetry Ingestion", accent: C.teal, icon: "pulse",
    chips: [
      ["Network Devices", "Routers · PE / CE · SD-WAN"],
      ["Collectors", "SNMP · NetFlow · Syslog"],
      ["Telegraf Agent", "Metric stream pipeline"],
      ["InfluxDB 2.7", "Time-series telemetry store"],
      ["Fault Injection", "5 live failure scenarios"],
    ],
  },
  {
    no: "02", title: "Predictive ML Core", accent: C.mauve, icon: "net",
    chips: [
      ["Feature Engineering", "Pandas · NumPy windows"],
      ["Prophet", "Trend forecast · time-to-impact"],
      ["Isolation Forest", "Unsupervised anomaly"],
      ["XGBoost", "Root-cause classifier"],
      ["Ensemble Predictor", "Fused confidence score"],
    ],
  },
  {
    no: "03", title: "Decision Intelligence", accent: C.peach, icon: "target",
    chips: [
      ["Digital Twin", "NetworkX live topology"],
      ["Risk Engine", "0–100 node risk score"],
      ["Blast Radius", "BFS impact propagation"],
      ["What-If Simulation", "Counterfactual preview"],
      ["Action Ranker", "Cost-aware runbook rank"],
    ],
  },
  {
    no: "04", title: "AI Copilot · ARIA", accent: C.pink, icon: "chat",
    chips: [
      ["RAG Engine", "Top-K context retrieval"],
      ["ChromaDB", "Vectors · BGE-Small embed"],
      ["Knowledge Base", "Runbooks + incident history"],
      ["Ollama Runtime", "Mistral 7B-Instruct (local)"],
      ["ARIA Copilot", "Streaming SSE answers"],
    ],
  },
  {
    no: "05", title: "VIKRAM", accent: C.blue, icon: "monitor",
    chips: [
      ["Next.js 15 App", "React Flow live canvas"],
      ["Risk Overlay", "Framer Motion alerts"],
      ["Blast · Sim · Copilot Panels", "Operator tooling"],
      ["Scenario Panel", "One-click fault inject"],
      ["Zustand Store", "Realtime state sync"],
    ],
  },
];

const FLOW = ["stream", "predict", "decide", "explain"];

const SPINE = [
  ["Background Orchestrator", "risk every 10s · predict 30s"],
  ["WebSocket Manager", "live broadcast to clients"],
  ["REST + Swagger API", "12 routers · async I/O"],
  ["Digital-Twin State", "in-memory graph runtime"],
];

const STORES = [
  ["PostgreSQL 16", "app & incident data", C.lavender],
  ["InfluxDB 2.7", "telemetry TSDB", C.teal],
  ["ChromaDB", "vector knowledge", C.pink],
  ["Ollama Models", "local LLM weights", C.peach],
  ["Prometheus + Grafana", "metrics & dashboards", C.green],
];

// ───────────────────────────── helpers ─────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(x, y, s, { size = 14, fill = C.ink, weight = 400, anchor = "start", spacing = 0, family = "Segoe UI, Inter, Arial, sans-serif", opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}">${esc(s)}</text>`;
}

function rrect(x, y, w, h, r, { fill = "none", stroke = "none", sw = 1, opacity = 1, dash = "", filter = "" } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" ${dash ? `stroke-dasharray="${dash}"` : ""} ${filter ? `filter="${filter}"` : ""}/>`;
}

// minimalist line icons, drawn in a 30x30 box at (x,y)
function icon(type, x, y, color) {
  const t = `<g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
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
    case "chat":
      body = `<path d="M3 6 H27 V20 H14 L8 26 V20 H3 Z"/><path d="M15 9 V17 M11 13 H19" stroke-width="2"/>`;
      break;
    case "monitor":
      body = `<rect x="2" y="3" width="26" height="18" rx="2.5"/><path d="M11 26 H19 M15 21 V26"/><path d="M7 16 L11 11 L15 14 L19 8 L23 12" stroke-width="2"/>`;
      break;
  }
  return t + body + `</g>`;
}

// solid right-pointing flow arrow with gradient + label above
function flowArrow(i) {
  const x1 = zoneX(i) + ZW + 6;
  const x2 = zoneX(i + 1) - 6;
  const y = ZMID;
  const head = 15, hh = 8.5;
  const grad = `url(#flow${i})`;
  return `
    <g filter="url(#softGlow)">
      <line x1="${x1}" y1="${y}" x2="${x2 - head + 2}" y2="${y}" stroke="${grad}" stroke-width="5" stroke-linecap="round"/>
      <path d="M${x2 - head} ${y - hh} L${x2} ${y} L${x2 - head} ${y + hh} Z" fill="${grad}"/>
    </g>
    ${text((x1 + x2) / 2, y - 16, FLOW[i].toUpperCase(), { size: 12.5, fill: C.sub, weight: 700, anchor: "middle", spacing: 1.5 })}`;
}

// ───────────────────────────── build zones ─────────────────────────────
function zoneCard(z, i) {
  const x = zoneX(i), y = ZTOP, accent = z.accent;
  let s = "";
  // card
  s += rrect(x, y, ZW, ZH, 18, { fill: "url(#cardFill)", stroke: C.cardEdge, sw: 1.4, filter: "url(#cardShadow)" });
  // top accent rule
  s += `<rect x="${x}" y="${y}" width="${ZW}" height="6" rx="3" fill="${accent}" opacity="0.95"/>`;
  s += rrect(x, y, ZW, ZH, 18, { stroke: accent, sw: 1, opacity: 0.22 });
  // header
  const hx = x + 20, hy = y + 30;
  s += `<g opacity="0.95">${icon(z.icon, hx, hy - 6, accent)}</g>`;
  s += text(hx + 44, hy + 4, z.no, { size: 13, fill: accent, weight: 800, spacing: 1 });
  s += text(hx + 44, hy + 24, z.title, { size: 18.5, fill: C.ink, weight: 700 });
  s += `<line x1="${x + 18}" y1="${y + 64}" x2="${x + ZW - 18}" y2="${y + 64}" stroke="${C.cardEdge}" stroke-width="1"/>`;
  // chips
  const chTop = y + 80, chH = 58, chGap = 9, chW = ZW - 36, chX = x + 18;
  z.chips.forEach(([t1, t2], k) => {
    const cy = chTop + k * (chH + chGap);
    s += rrect(chX, cy, chW, chH, 11, { fill: C.chip, stroke: C.chipEdge, sw: 1 });
    s += `<rect x="${chX}" y="${cy + 8}" width="4" height="${chH - 16}" rx="2" fill="${accent}" opacity="0.9"/>`;
    s += text(chX + 18, cy + 24, t1, { size: 14.5, fill: C.ink, weight: 650 });
    s += text(chX + 18, cy + 43, t2, { size: 12.5, fill: C.sub });
  });
  return s;
}

// ───────────────────────────── assemble svg ─────────────────────────────
let svg = "";

// defs
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
  <linearGradient id="flow1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.peach}"/></linearGradient>
  <linearGradient id="flow2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.peach}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <linearGradient id="flow3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
  <linearGradient id="titleAccent" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.teal}"/><stop offset="0.5" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.blue}"/>
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
// subtle grid dots
let dots = `<g fill="${C.faint}" opacity="0.06">`;
for (let gx = 40; gx < W; gx += 48) for (let gy = 40; gy < H; gy += 48) dots += `<circle cx="${gx}" cy="${gy}" r="1.3"/>`;
dots += `</g>`;
svg += dots;

// ── title bar ──
svg += text(72, 70, "PS13 — Air-Gapped Predictive NOC Copilot", { size: 38, fill: C.ink, weight: 800, spacing: 0.2 });
svg += `<rect x="74" y="84" width="430" height="4" rx="2" fill="url(#titleAccent)"/>`;
svg += text(72, 112, "Closed-loop VIKRAM control for MPLS / SD-WAN networks  ·  predict → explain → remediate, 100% offline", { size: 16, fill: C.sub, weight: 500 });

// air-gapped badge (top right)
const bw = 360, bx = W - 72 - bw, by = 44;
svg += rrect(bx, by, bw, 64, 14, { fill: "#10182a", stroke: C.green, sw: 1.3, opacity: 1 });
svg += rrect(bx, by, bw, 64, 14, { fill: C.green, stroke: "none", opacity: 0.06 });
// lock glyph
svg += `<g transform="translate(${bx + 22},${by + 18})" fill="none" stroke="${C.green}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="12" width="24" height="17" rx="3.5"/><path d="M7 12 V8 a7 7 0 0 1 14 0 V12"/><circle cx="14" cy="20" r="2.4" fill="${C.green}" stroke="none"/></g>`;
svg += text(bx + 64, by + 28, "100% AIR-GAPPED", { size: 17, fill: C.green, weight: 800, spacing: 0.6 });
svg += text(bx + 64, by + 48, "Zero external API calls · single workstation", { size: 12.5, fill: C.sub });

// ── perimeter boundary ──
const PB = { x: 48, y: 132, w: W - 96, h: 852 };
svg += rrect(PB.x, PB.y, PB.w, PB.h, 22, { stroke: C.cardEdge, sw: 1.6, dash: "2 9", opacity: 0.8 });
svg += text(PB.x + 22, PB.y - 0 + 26, "SECURE PERIMETER", { size: 11.5, fill: C.faint, weight: 700, spacing: 2 });
// little corner ticks
for (const [cx, cy] of [[PB.x, PB.y], [PB.x + PB.w, PB.y], [PB.x, PB.y + PB.h], [PB.x + PB.w, PB.y + PB.h]]) {
  svg += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${C.sapphire}" opacity="0.7"/>`;
}

// ── zones + flow arrows ──
ZONES.forEach((z, i) => { svg += zoneCard(z, i); });
for (let i = 0; i < 4; i++) svg += flowArrow(i);

// ── zone → spine connectors (faint), zones 1-4 ──
for (let i = 0; i < 4; i++) {
  const cx = zoneCx(i);
  svg += `<line x1="${cx}" y1="${ZTOP + ZH}" x2="${cx}" y2="${SPINE_T}" stroke="${ZONES[i].accent}" stroke-width="2" opacity="0.32"/>`;
  svg += `<circle cx="${cx}" cy="${ZTOP + ZH}" r="3" fill="${ZONES[i].accent}" opacity="0.6"/>`;
  svg += `<path d="M${cx - 5} ${SPINE_T - 9} L${cx} ${SPINE_T - 1} L${cx + 5} ${SPINE_T - 9} Z" fill="${ZONES[i].accent}" opacity="0.55"/>`;
}

// ── spine band ──
svg += rrect(ZL, SPINE_T, ZW * 5 + GAP * 4, SPINE_H, 16, { fill: "url(#spineFill)", stroke: C.sapphire, sw: 1.3 });
svg += rrect(ZL, SPINE_T, ZW * 5 + GAP * 4, SPINE_H, 16, { fill: C.sapphire, opacity: 0.05 });
svg += text(ZL + 26, SPINE_T + 36, "FastAPI", { size: 19, fill: C.ink, weight: 800 });
svg += text(ZL + 26, SPINE_T + 58, "Async Backend", { size: 13, fill: C.sapphire, weight: 600 });
svg += text(ZL + 26, SPINE_T + 76, "Orchestration spine", { size: 11.5, fill: C.sub });
{
  const pillL = ZL + 168, pillR = ZL + ZW * 5 + GAP * 4 - 20;
  const pw = (pillR - pillL - 3 * 14) / 4;
  SPINE.forEach(([a, b], k) => {
    const px = pillL + k * (pw + 14), py = SPINE_T + 16, ph = SPINE_H - 32;
    svg += rrect(px, py, pw, ph, 11, { fill: "#11182a", stroke: C.chipEdge, sw: 1 });
    svg += `<circle cx="${px + 16}" cy="${py + ph / 2}" r="3.4" fill="${C.sapphire}"/>`;
    svg += text(px + 30, py + ph / 2 - 4, a, { size: 14.5, fill: C.ink, weight: 650 });
    svg += text(px + 30, py + ph / 2 + 15, b, { size: 12, fill: C.sub });
  });
}

// ── real-time WebSocket arrow: spine → Zone 5 (points UP) ──
{
  const cx = zoneCx(4);
  svg += `<line x1="${cx}" y1="${SPINE_T}" x2="${cx}" y2="${ZTOP + ZH + 11}" stroke="${C.blue}" stroke-width="3.2"/>`;
  svg += `<path d="M${cx - 7} ${ZTOP + ZH + 12} L${cx} ${ZTOP + ZH + 1} L${cx + 7} ${ZTOP + ZH + 12} Z" fill="${C.blue}"/>`;
  svg += rrect(cx + 12, (SPINE_T + ZTOP + ZH) / 2 - 15, 150, 30, 8, { fill: "#10182a", stroke: C.blue, sw: 1 });
  svg += text(cx + 22, (SPINE_T + ZTOP + ZH) / 2 + 5, "WebSocket + SSE", { size: 12.5, fill: C.blue, weight: 700 });
}

// ── spine ↔ data connector (center, bidirectional) ──
{
  const cx = 960;
  svg += `<line x1="${cx}" y1="${SPINE_B + 2}" x2="${cx}" y2="${DATA_T - 2}" stroke="${C.lavender}" stroke-width="2.4" opacity="0.7"/>`;
  svg += `<path d="M${cx - 6} ${DATA_T - 10} L${cx} ${DATA_T - 1} L${cx + 6} ${DATA_T - 10} Z" fill="${C.lavender}" opacity="0.85"/>`;
  svg += `<path d="M${cx - 6} ${SPINE_B + 10} L${cx} ${SPINE_B + 1} L${cx + 6} ${SPINE_B + 10} Z" fill="${C.lavender}" opacity="0.85"/>`;
  svg += rrect(cx + 12, (SPINE_B + DATA_T) / 2 - 14, 148, 28, 8, { fill: "#121626", stroke: C.lavender, sw: 1 });
  svg += text(cx + 21, (SPINE_B + DATA_T) / 2 + 5, "persist / query", { size: 12, fill: C.lavender, weight: 650 });
}

// ── data / persistence band ──
svg += text(ZL + 4, DATA_T - 12, "PERSISTENCE & OBSERVABILITY", { size: 12, fill: C.faint, weight: 700, spacing: 2 });
svg += text(ZL + 270, DATA_T - 12, "— local Docker volumes, no cloud", { size: 12, fill: C.sub });
{
  const totalW = ZW * 5 + GAP * 4;
  const n = STORES.length, sg = 22;
  const sw = (totalW - sg * (n - 1)) / n;
  STORES.forEach(([a, b, col], k) => {
    const sx = ZL + k * (sw + sg), sy = DATA_T + 18, sh = DATA_H - 30;
    svg += rrect(sx, sy, sw, sh, 13, { fill: "url(#cardFill)", stroke: C.cardEdge, sw: 1.2, filter: "url(#cardShadow)" });
    svg += `<rect x="${sx}" y="${sy}" width="${sw}" height="5" rx="2.5" fill="${col}" opacity="0.9"/>`;
    // db cylinder glyph
    svg += `<g transform="translate(${sx + 20},${sy + 34})" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round">
      <ellipse cx="11" cy="6" rx="11" ry="4.5"/><path d="M0 6 V22 a11 4.5 0 0 0 22 0 V6"/><path d="M0 14 a11 4.5 0 0 0 22 0"/></g>`;
    svg += text(sx + 56, sy + 38, a, { size: 15.5, fill: C.ink, weight: 700 });
    svg += text(sx + 22, sy + 74, b, { size: 12.5, fill: C.sub });
  });
}

// ── footer legend ──
const fy = DATA_B + 40;
svg += text(72, fy, "Stack:", { size: 13, fill: C.faint, weight: 700 });
svg += text(122, fy, "Next.js 15 · FastAPI · Ollama / Mistral 7B · NetworkX · Prophet · XGBoost · ChromaDB · InfluxDB · PostgreSQL · Docker", { size: 13, fill: C.sub });
// arrow legend (right)
{
  let lx = W - 72 - 520;
  const ly = fy - 5;
  const item = (x, draw, label) => {
    svg += draw(x, ly);
    return x + 28 + label.length * 6.6 + 26;
  };
  let x = lx;
  svg += `<line x1="${x}" y1="${ly}" x2="${x + 22}" y2="${ly}" stroke="url(#flow1)" stroke-width="4" stroke-linecap="round"/><path d="M${x + 22} ${ly - 5} L${x + 30} ${ly} L${x + 22} ${ly + 5} Z" fill="${C.peach}"/>`;
  svg += text(x + 38, ly + 4, "pipeline flow", { size: 12.5, fill: C.sub }); x += 170;
  svg += `<line x1="${x}" y1="${ly + 6}" x2="${x}" y2="${ly - 6}" stroke="${C.blue}" stroke-width="3"/><path d="M${x - 5} ${ly - 5} L${x} ${ly - 11} L${x + 5} ${ly - 5} Z" fill="${C.blue}"/>`;
  svg += text(x + 14, ly + 4, "real-time push", { size: 12.5, fill: C.sub }); x += 170;
  svg += `<line x1="${x}" y1="${ly}" x2="${x + 30}" y2="${ly}" stroke="${C.lavender}" stroke-width="2.4"/><path d="M${x + 8} ${ly - 5} L${x} ${ly} L${x + 8} ${ly + 5} Z" fill="${C.lavender}"/><path d="M${x + 22} ${ly - 5} L${x + 30} ${ly} L${x + 22} ${ly + 5} Z" fill="${C.lavender}"/>`;
  svg += text(x + 40, ly + 4, "persist / query", { size: 12.5, fill: C.sub });
}

// wrap
const svgDoc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`;

// ───────────────────────────── write files ─────────────────────────────
const svgPath = join(__dirname, "ps13-architecture.svg");
const htmlPath = join(__dirname, "ps13-architecture.html");
const pdfPath = join(__dirname, "ps13-architecture.pdf");

writeFileSync(svgPath, svgDoc, "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: ${W / 96}in ${H / 96}in; margin: 0; }
  html,body { margin:0; padding:0; background:${C.bg0}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  svg { display:block; width:${W}px; height:${H}px; }
</style></head><body>${svgDoc}</body></html>`;
writeFileSync(htmlPath, html, "utf8");

console.log("SVG :", svgPath);
console.log("HTML:", htmlPath);

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
    console.log("PDF :", pdfPath, "(via", exe.split("/").pop() + ")");
    break;
  } catch (e) {
    // try next browser
  }
}
if (!rendered) console.log("PDF render skipped (no headless browser succeeded).");
