import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#09090b",
        card: "#18181b",
        cardHover: "#212124",
        borderDark: "#27272a",
        borderLight: "#3f3f46",
        foregroundMuted: "#a1a1aa",
        foregroundBright: "#f4f4f5",
        accentGreen: "#10b981",
        accentAmber: "#f59e0b",
        accentRed: "#ef4444",
        accentBlue: "#3b82f6",
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
