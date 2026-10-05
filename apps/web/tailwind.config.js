/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        graphite: {
          DEFAULT: "#171717",
          50: "#f5f5f5",
          100: "#e8e8e8",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#666666",
          600: "#444444",
          700: "#2d2d2d",
          800: "#1f1f1f",
          900: "#171717",
          950: "#0d0d0d",
        },
        ivory: {
          DEFAULT: "#F5F0E7",
          warm: "#F5F0E7",
          soft: "#EDE8DF",
        },
        stone: {
          rift: "#E7E0D4",
          muted: "#D4CEC6",
        },
        vermilion: {
          DEFAULT: "#E85D4A",
          light: "#F07B6B",
          dark: "#C44836",
        },
        golden: {
          DEFAULT: "#D8AA42",
          light: "#E6BF6B",
          dark: "#B88B2A",
        },
        sage: {
          DEFAULT: "#7FA083",
          light: "#9DB8A0",
          dark: "#5E7D62",
        },
        iris: {
          DEFAULT: "#9586B8",
          light: "#B0A3CE",
          dark: "#7165A0",
        },
        plum: {
          DEFAULT: "#4B3A4F",
          light: "#6B5270",
          dark: "#2E2130",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        control: "12px",
        card: "16px",
        panel: "20px",
        hero: "28px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "stream-flow": "streamFlow 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseDot: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        streamFlow: { "0%": { strokeDashoffset: "100" }, "100%": { strokeDashoffset: "0" } },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
        panel: "0 2px 8px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.08)",
        elevated: "0 4px 16px rgba(0,0,0,0.14), 0 16px 48px rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [],
};
