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
    },
  },
  plugins: [],
};
