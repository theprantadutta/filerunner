import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        sunken: token("sunken"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        "ink-3": token("ink-3"),
        line: token("line"),
        "line-strong": token("line-strong"),
        rail: token("rail"),
        "rail-ink": token("rail-ink"),
        "rail-muted": token("rail-muted"),
        nav: token("nav"),
        "nav-ink": token("nav-ink"),
        "nav-muted": token("nav-muted"),
        brand: token("brand"),
        "brand-ink": token("brand-ink"),
        "brand-soft": token("brand-soft"),
        good: token("good"),
        warn: token("warn"),
        bad: token("bad"),
        c1: token("c1"),
        c2: token("c2"),
        c3: token("c3"),
        c4: token("c4"),
        c5: token("c5"),
        c6: token("c6"),
        c7: token("c7"),
        c8: token("c8"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "var(--radius)",
        xl: "18px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        lift: "0 1px 2px rgb(15 18 30 / 0.05), 0 8px 24px -12px rgb(15 18 30 / 0.12)",
        pop: "0 24px 48px -16px rgb(10 12 20 / 0.28), 0 4px 12px -4px rgb(10 12 20 / 0.12)",
      },
      keyframes: {
        "rise": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "tile-shift": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(0.92)", opacity: "0.55" },
        },
        "bar-in": {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
        "shine": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        rise: "rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        fade: "fade 0.25s ease-out both",
        "tile-shift": "tile-shift 3.2s ease-in-out infinite",
        "bar-in": "bar-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shine: "shine 1.6s linear infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
