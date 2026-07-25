import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [
    function ({ addBase }: any) {
      addBase({
        // Force Western Arabic numerals (0-9) in all elements
        "*": { "font-variant-numeric": "normal" },
        // Specifically target number-heavy elements
        "td, th, input, .stat-value, .badge, code, pre": {
          "font-feature-settings": '"lnum" 1, "tnum" 1',
        },
      });
    },
  ],
};

export default config;
