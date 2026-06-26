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
        // ── Dark grimoire / parchment palette ───────────────────────────────
        // Token names are IDENTICAL to original — only values change.
        // This means every existing class (bg-void, text-plasma, etc.) keeps
        // working — it just renders in the arcane colour scheme.

        // void: deep dark leather — was #02040a sci-fi black
        void: { DEFAULT: "#080502", 50: "#120a05" },

        // plasma: aged gold / arcane amber — was #7c3aed purple
        plasma: {
          DEFAULT: "#c9a55a",
          400: "#e8c87a",
          600: "#a07838",
          800: "#6b4c1a",
        },

        // neon: warm umber / ember glow — was #06b6d4 cyan
        neon: {
          DEFAULT: "#d49060",
          400: "#e8b080",
          600: "#b07040",
        },

        // ember: vermilion / fire-red — was #f97316 orange
        ember: {
          DEFAULT: "#c84020",
          400: "#e06040",
          600: "#a03010",
        },

        // acid: forest moss — was #84cc16 lime
        acid: {
          DEFAULT: "#7a8c3a",
          400: "#98a850",
        },

        // Risk level colours (keep functional legibility)
        risk: {
          healthy:  "#4a9c5a",
          low:      "#7a8c3a",
          medium:   "#c89828",
          high:     "#c84020",
          critical: "#d42020",
        },

        // Surface colours — dark leather progression
        surface: {
          0: "#080502",
          1: "#120a05",
          2: "#1c1008",
          3: "#26160a",
          4: "#301c0c",
        },

        border: { DEFAULT: "rgba(180,130,50,0.22)" },
        glow: {
          plasma: "rgba(201,165,90,0.45)",
          neon:   "rgba(212,144,96,0.35)",
        },
      },

      fontFamily: {
        // JetBrains Mono stays for all technical readouts
        mono:    ["'JetBrains Mono'", "Consolas", "monospace"],
        // Body: keep Inter for dense NOC data legibility
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        // Display headers → Cinzel (Roman / arcane)
        display: ["'Cinzel'", "Georgia", "serif"],
        // Landing hero title → blackletter
        rune:    ["'UnifrakturMaguntia'", "Georgia", "serif"],
        // Elegant serif for subtitles
        serif:   ["'Lora'", "Georgia", "serif"],
      },

      animation: {
        "pulse-slow":  "pulse 3s ease-in-out infinite",
        "pulse-fast":  "pulse 0.8s ease-in-out infinite",
        "glow-ring":   "glowRing 2s ease-in-out infinite",
        "risk-wave":   "riskWave 1.5s ease-out infinite",
        "packet-flow": "packetFlow 2s linear infinite",
        "scan-line":   "scanLine 3s linear infinite",
        "flicker":     "flicker 0.15s ease-in-out infinite",
        "ripple":      "ripple 1.5s ease-out infinite",
        "spin-slow":   "spin 8s linear infinite",
        "float":       "float 4s ease-in-out infinite",
        "ember-rise":  "emberRise 6s ease-in-out infinite",
        "sigil-spin":  "sigilSpin 20s linear infinite",
      },

      keyframes: {
        glowRing: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(201,165,90,0.3)" },
          "50%":       { boxShadow: "0 0 30px rgba(201,165,90,0.8), 0 0 60px rgba(201,165,90,0.3)" },
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
        emberRise: {
          "0%":   { transform: "translateY(10px)", opacity: "0" },
          "20%":  { opacity: "1" },
          "80%":  { opacity: "0.6" },
          "100%": { transform: "translateY(-40px)", opacity: "0" },
        },
        sigilSpin: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },

      backgroundImage: {
        "grid-pattern":    "linear-gradient(rgba(180,130,50,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(180,130,50,0.04) 1px, transparent 1px)",
        "radar-gradient":  "radial-gradient(circle, rgba(201,165,90,0.12) 0%, transparent 70%)",
        "void-gradient":   "linear-gradient(135deg, #080502 0%, #120a05 50%, #080502 100%)",
        "parchment-noise": "url('/noise.png')",
      },
      backgroundSize: {
        grid: "40px 40px",
      },

      boxShadow: {
        plasma:         "0 0 20px rgba(201,165,90,0.5)",
        neon:           "0 0 20px rgba(212,144,96,0.4)",
        "risk-critical":"0 0 25px rgba(212,32,32,0.6)",
        "risk-high":    "0 0 20px rgba(200,64,32,0.5)",
        "risk-medium":  "0 0 15px rgba(200,152,40,0.4)",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
