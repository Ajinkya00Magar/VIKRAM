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
        // ── VIKRAM · charcoal / deep-space palette ───────────────────────────
        // Token names are IDENTICAL to the original — only values change.
        // This means every existing class (bg-void, text-plasma, etc.) keeps
        // working — it just renders in the charcoal / starlight scheme.

        // void: charcoal near-black deep-space backdrop
        void: { DEFAULT: "#0a0b0e", 50: "#101216" },

        // plasma: primary accent — starlight blue
        plasma: {
          DEFAULT: "#8fb4ff",
          400: "#b3ccff",
          600: "#5f8fe0",
          800: "#2e4a80",
        },

        // neon: secondary accent — pale ice blue
        neon: {
          DEFAULT: "#a9c7ea",
          400: "#cbe0f5",
          600: "#7ea8d8",
        },

        // ember: functional alert / prediction accent — muted amber
        ember: {
          DEFAULT: "#d98a4a",
          400: "#e8a86c",
          600: "#b56a30",
        },

        // acid: low-signal accent — cool sage
        acid: {
          DEFAULT: "#8a9a7a",
          400: "#a6b596",
        },

        // Risk level colours — harmonised with the charcoal / starlight theme
        risk: {
          healthy:  "#57b6a6",
          low:      "#7fb0d6",
          medium:   "#d8b062",
          high:     "#dd8a4a",
          critical: "#e26370",
        },

        // Surface colours — charcoal progression
        surface: {
          0: "#0a0b0e",
          1: "#101216",
          2: "#16181d",
          3: "#1c1f26",
          4: "#24272f",
        },

        border: { DEFAULT: "rgba(160,178,210,0.16)" },
        glow: {
          plasma: "rgba(143,180,255,0.45)",
          neon:   "rgba(169,199,234,0.32)",
        },
      },

      fontFamily: {
        // JetBrains Mono stays for all technical readouts
        mono:    ["'JetBrains Mono'", "Consolas", "monospace"],
        // Body: keep Inter for dense NOC data legibility
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        // Display headers → Space Grotesk (geometric / spacefaring)
        display: ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        // Landing hero wordmark → Space Grotesk (heavy)
        rune:    ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        // Subtitles → Space Grotesk
        serif:   ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
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
          "0%, 100%": { boxShadow: "0 0 10px rgba(143,180,255,0.3)" },
          "50%":       { boxShadow: "0 0 30px rgba(143,180,255,0.8), 0 0 60px rgba(143,180,255,0.3)" },
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
        "grid-pattern":    "linear-gradient(rgba(150,170,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(150,170,210,0.05) 1px, transparent 1px)",
        "radar-gradient":  "radial-gradient(circle, rgba(143,180,255,0.12) 0%, transparent 70%)",
        "void-gradient":   "linear-gradient(135deg, #0a0b0e 0%, #101216 50%, #0a0b0e 100%)",
        "parchment-noise": "url('/noise.png')",
      },
      backgroundSize: {
        grid: "40px 40px",
      },

      boxShadow: {
        plasma:         "0 0 20px rgba(143,180,255,0.5)",
        neon:           "0 0 20px rgba(169,199,234,0.4)",
        "risk-critical":"0 0 25px rgba(229,72,77,0.6)",
        "risk-high":    "0 0 20px rgba(217,122,58,0.5)",
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
