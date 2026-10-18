import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#07090d",
        panel: "#0d1117",
        panel2: "#121820",
        line: "#1d2630",
        muted: "#7d8a99",
        text: "#d7dee7",
        up: "#22c55e",
        down: "#ef4444",
        warn: "#f5a524",
        accent: "#38bdf8",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
