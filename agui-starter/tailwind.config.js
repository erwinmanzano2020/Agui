/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--bg-hsl))",
        foreground: "hsl(var(--fg-hsl))",
        border: "hsl(var(--border-hsl))",
        ring: "hsl(var(--agui-accent-hsl) / var(--agui-ring-alpha))",
        card: {
          DEFAULT: "hsl(var(--card-hsl))",
          foreground: "hsl(var(--fg-hsl))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted-hsl))",
          foreground: "hsl(var(--fg-hsl))",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          foreground: "var(--danger-foreground)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--agui-radius)",
      },
    },
  },
  plugins: [],
};
