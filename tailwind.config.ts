import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slatebg: "#f5f5ef",
        ink: "#1b1f24",
        accent: "#0f766e",
        warn: "#9a3412"
      }
    }
  },
  plugins: []
} satisfies Config;
