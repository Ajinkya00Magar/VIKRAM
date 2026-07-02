"use client";

import { useEffect, useRef } from "react";

interface LiquidWordmarkProps {
  text?: string;
  className?: string;
}

/**
 * VIKRAM wordmark rendered to a canvas and driven by a classic height-field
 * water simulation. Moving the cursor anywhere over the wordmark "intrudes"
 * the surface and the letters ripple like water. The ripple runs on a
 * downscaled grid and the refraction offset is clamped, so the text warps
 * smoothly instead of shattering. Respects prefers-reduced-motion.
 */
export default function LiquidWordmark({
  text = "VIKRAM",
  className,
}: LiquidWordmarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const DAMPING = 0.95; // wave energy retained per frame
    const REFRACT = 1.25; // how strongly height gradient bends the text
    const MAX_OFFSET = 15; // clamp displacement (px) → smooth, never shattered
    const CELL = 2; // ripple grid is 1/CELL the canvas res (perf + smoother)
    const MAX_PIXELS = 150_000;

    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let cur = new Float32Array(0); // height buffers on the ripple grid
    let prev = new Float32Array(0);
    let source: ImageData | null = null;
    let output: ImageData | null = null;
    let raf = 0;
    let tick = 0;

    // ── Render the wordmark and capture it as the refraction source ────────
    function build() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const cssW = Math.max(1, parent.clientWidth);
      const cssH = Math.max(1, parent.clientHeight);

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      let scale = dpr;
      if (cssW * cssH * scale * scale > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / (cssW * cssH));
      }
      W = Math.max(2, Math.floor(cssW * scale));
      H = Math.max(2, Math.floor(cssH * scale));

      canvas!.width = W;
      canvas!.height = H;
      canvas!.style.width = cssW + "px";
      canvas!.style.height = cssH + "px";

      cols = Math.ceil(W / CELL) + 1;
      rows = Math.ceil(H / CELL) + 1;
      cur = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);

      drawBase();
    }

    function drawBase() {
      ctx!.clearRect(0, 0, W, H);

      const spacing = 0.1; // extra gap between glyphs, in font-size units
      let fontSize = Math.floor(H * 0.72);
      ctx!.textBaseline = "middle";
      ctx!.textAlign = "left";
      const measure = () => {
        ctx!.font = `700 ${fontSize}px 'Space Grotesk','Inter',sans-serif`;
        let total = 0;
        for (const ch of text) total += ctx!.measureText(ch).width + fontSize * spacing;
        return total - fontSize * spacing;
      };
      while (measure() > W * 0.92 && fontSize > 8) fontSize -= 2;

      const grad = ctx!.createLinearGradient(0, H * 0.12, 0, H * 0.92);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#d3e2ff");
      grad.addColorStop(1, "#8fb4ff");
      ctx!.fillStyle = grad;
      ctx!.shadowColor = "rgba(143,180,255,0.5)";
      ctx!.shadowBlur = fontSize * 0.16;

      const totalW = measure();
      let x = (W - totalW) / 2;
      const y = H / 2;
      for (const ch of text) {
        const w = ctx!.measureText(ch).width;
        ctx!.fillText(ch, x, y);
        x += w + fontSize * spacing;
      }
      ctx!.shadowBlur = 0;

      source = ctx!.getImageData(0, 0, W, H);
      output = ctx!.createImageData(W, H);
    }

    // ── Add a disturbance on the ripple grid ──────────────────────────────
    function drop(gx: number, gy: number, power: number) {
      const cx = Math.round(gx);
      const cy = Math.round(gy);
      const r = 2;
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const nx = cx + x;
          const ny = cy + y;
          if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) continue;
          const d = Math.hypot(x, y);
          if (d > r) continue;
          cur[nx + ny * cols] += power * (1 - d / (r + 1));
        }
      }
    }

    // ── One simulation + render frame ─────────────────────────────────────
    function frame() {
      tick++;

      // Ambient idle ripples keep the surface alive without the cursor.
      if (!reduceMotion && tick % 130 === 0) {
        const gx = cols * (0.15 + 0.7 * Math.abs(Math.sin(tick * 0.017)));
        const gy = rows * (0.3 + 0.4 * Math.abs(Math.cos(tick * 0.011)));
        drop(gx, gy, 70);
      }

      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          const val =
            (cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) / 2 -
            prev[i];
          prev[i] = val * DAMPING;
        }
      }
      const tmp = prev;
      prev = cur;
      cur = tmp; // cur now holds the latest heights

      const src = source!.data;
      const out = output!.data;
      for (let y = 0; y < H; y++) {
        const gy = (y / CELL) | 0;
        const grow = gy * cols;
        for (let x = 0; x < W; x++) {
          const gx = (x / CELL) | 0;
          let xo = 0;
          let yo = 0;
          if (gx > 0 && gx < cols - 1 && gy > 0 && gy < rows - 1) {
            const gi = grow + gx;
            xo = (cur[gi - 1] - cur[gi + 1]) * REFRACT;
            yo = (cur[gi - cols] - cur[gi + cols]) * REFRACT;
          }
          if (xo > MAX_OFFSET) xo = MAX_OFFSET;
          else if (xo < -MAX_OFFSET) xo = -MAX_OFFSET;
          if (yo > MAX_OFFSET) yo = MAX_OFFSET;
          else if (yo < -MAX_OFFSET) yo = -MAX_OFFSET;

          let sx = (x + xo) | 0;
          let sy = (y + yo) | 0;
          if (sx < 0) sx = 0;
          else if (sx >= W) sx = W - 1;
          if (sy < 0) sy = 0;
          else if (sy >= H) sy = H - 1;

          const si = (sx + sy * W) * 4;
          const di = (x + y * W) * 4;
          // subtle specular glint where the surface tilts toward the light
          const glint = Math.max(0, Math.min(60, (xo + yo) * 5));
          out[di] = Math.min(255, src[si] + glint);
          out[di + 1] = Math.min(255, src[si + 1] + glint);
          out[di + 2] = Math.min(255, src[si + 2] + glint);
          out[di + 3] = src[si + 3];
        }
      }
      ctx!.putImageData(output!, 0, 0);
      raf = requestAnimationFrame(frame);
    }

    // ── Pointer → water intrusion (listen on window so hovering anywhere
    //    over the wordmark region ripples it) ───────────────────────────────
    let lastGX = -1;
    let lastGY = -1;
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const gx = ((e.clientX - rect.left) / rect.width) * cols;
      const gy = ((e.clientY - rect.top) / rect.height) * rows;
      // Only react within (and just around) the wordmark box.
      if (gx < -2 || gy < -2 || gx > cols + 2 || gy > rows + 2) {
        lastGX = -1;
        return;
      }
      let speed = 0;
      if (lastGX >= 0) speed = Math.hypot(gx - lastGX, gy - lastGY);
      lastGX = gx;
      lastGY = gy;
      drop(gx, gy, 55 + Math.min(180, speed * 16));
    }

    function loop() {
      raf = requestAnimationFrame(frame);
    }

    build();
    // Cursor reactivity is user-initiated, so keep it even under reduce-motion;
    // only the automatic idle ripples are suppressed (handled in frame()).
    window.addEventListener("pointermove", onMove, { passive: true });
    if (!reduceMotion) drop(cols / 2, rows / 2, 240); // opening splash
    loop();

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      build();
      loop();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
    };
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={text}
      style={{ pointerEvents: "none" }}
    />
  );
}
