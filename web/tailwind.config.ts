import type { Config } from "tailwindcss";

// Colours are CSS variables (app/globals.css) so light and dark share one set of names.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        active: "var(--active)",
        line: "var(--border)",
        rule: "var(--rule)",
        control: "var(--control)",
        ink: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: {
          DEFAULT: "var(--primary)",
          ink: "var(--primary-ink)",
          hover: "var(--primary-hover)",
        },
        cite: {
          DEFAULT: "var(--cite)",
          soft: "var(--cite-soft)",
        },
        danger: {
          DEFAULT: "var(--negative)",
          soft: "var(--negative-soft)",
          ink: "var(--negative-ink)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "8px",
        control: "6px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      boxShadow: {
        float: "0 8px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
        composer: "0 2px 8px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
