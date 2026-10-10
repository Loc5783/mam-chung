import plugin from "tailwindcss/plugin.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        "primary-light": "var(--primary-light)",
        "primary-lighter": "var(--primary-lighter)",
        pink: "var(--pink)",
        "pink-dark": "var(--pink-dark)",
        "pink-light": "var(--pink-light)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        border: "var(--border)",
        danger: "var(--danger)",
      },
      fontFamily: {
        heading: ["Fraunces", "Georgia", "serif"],
        sans: ["Be Vietnam Pro", "sans-serif"],
      },
      borderRadius: { card: "16px", control: "10px" },
      transitionDuration: {
        instant: "var(--dur-instant)",
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
        chart: "var(--dur-chart)",
        count: "var(--dur-count)",
      },
      transitionTimingFunction: {
        "out-soft": "var(--ease-out)",
        "in-out-soft": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      boxShadow: {
        rest: "var(--shadow-rest)",
        "hover-green": "var(--shadow-hover-green)",
        "hover-pink": "var(--shadow-hover-pink)",
        "card-hover": "var(--shadow-card-hover)",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("hoverable", "@media (hover: hover) and (pointer: fine)");
    }),
  ],
};
