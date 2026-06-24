/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand: deep space / mission control aesthetic
        void:    { DEFAULT: "#02040a", 50: "#080e1a" },
        plasma:  { DEFAULT: "#7c3aed", 400: "#a855f7", 600: "#6d28d9", 800: "#4c1d95" },
        neon:    { DEFAULT: "#06b6d4", 400: "#22d3ee", 600: "#0891b2" },
        ember:   { DEFAULT: "#f97316", 400: "#fb923c", 600: "#ea580c" },
        acid:    { DEFAULT: "#84cc16", 400: "#a3e635" },

        // Risk level colors
        risk: {
          healthy:  "#22c55e",
          low:      "#84cc16",
          medium:   "#eab308",
          high:     "#f97316",
          critical: "#ef4444",
        },

        // Surface colors
        surface: {
          0: "#02040a",
          1: "#070d1a",
          2: "#0c1428",
          3: "#101c35",
          4: "#162342",
        },

        border: { DEFAULT: "rgba(99,102,241,0.2)" },
        glow:   { plasma: "rgba(124,58,237,0.5)", neon: "rgba(6,182,212,0.4)" },
      },

      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
      },

      animation: {
        "pulse-slow":    "pulse 3s ease-in-out infinite",
        "pulse-fast":    "pulse 0.8s ease-in-out infinite",
        "glow-ring":     "glowRing 2s ease-in-out infinite",
        "risk-wave":     "riskWave 1.5s ease-out infinite",
        "packet-flow":   "packetFlow 2s linear infinite",
        "scan-line":     "scanLine 3s linear infinite",
        "flicker":       "flicker 0.15s ease-in-out infinite",
        "ripple":        "ripple 1.5s ease-out infinite",
        "spin-slow":     "spin 8s linear infinite",
        "float":         "float 4s ease-in-out infinite",
      },

      keyframes: {
        glowRing: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(124,58,237,0.3)" },
          "50%":       { boxShadow: "0 0 30px rgba(124,58,237,0.8), 0 0 60px rgba(124,58,237,0.3)" },
        },
        riskWave: {
          "0%":   { transform: "scale(1)",   opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        packetFlow: {
          "0%":   { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" },
        },
        scanLine: {
          "0%":   { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.4" },
        },
        ripple: {
          "0%":   { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2)",   opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-8px)" },
        },
      },

      backgroundImage: {
        "grid-pattern": "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
        "radar-gradient": "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
        "void-gradient": "linear-gradient(135deg, #02040a 0%, #070d1a 50%, #02040a 100%)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },

      boxShadow: {
        "plasma": "0 0 20px rgba(124,58,237,0.5)",
        "neon":   "0 0 20px rgba(6,182,212,0.4)",
        "risk-critical": "0 0 25px rgba(239,68,68,0.6)",
        "risk-high":     "0 0 20px rgba(249,115,22,0.5)",
        "risk-medium":   "0 0 15px rgba(234,179,8,0.4)",
      },

      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
