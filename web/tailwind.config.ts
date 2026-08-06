import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#212121",
          elevated: "#2f2f2f",
          sidebar: "#171717",
          chat: "#212121",
          input: "#303030",
          hover: "#2a2a2a",
          border: "#3f3f3f",
        },
        accent: {
          DEFAULT: "#10a37f",
          hover: "#0d8f6f",
          muted: "#1a3d34",
        },
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      boxShadow: {
        drawer: "4px 0 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
