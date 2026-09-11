import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wa: {
          bg: "#0b141a",
          panel: "#111b21",
          panel2: "#202c33",
          border: "#2a3942",
          bubbleIn: "#202c33",
          bubbleOut: "#005c4b",
          green: "#00a884",
          text: "#e9edef",
          muted: "#8696a0",
        },
      },
    },
  },
  plugins: [],
};

export default config;
