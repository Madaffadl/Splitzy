import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                    strong: "hsl(var(--accent-strong))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            // Design-system typography tokens (Sprint 2). Additive: a semantic
            // marketing type scale consumed by new surfaces (pricing, new
            // landing). Existing text-* utilities are unchanged.
            fontSize: {
                "display-1": ["clamp(2.5rem, 5vw, 3.75rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "800" }],
                "display-2": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
                "heading": ["clamp(1.5rem, 2.5vw, 2rem)", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
                "eyebrow": ["0.8125rem", { lineHeight: "1", letterSpacing: "0.08em", fontWeight: "600" }],
                "lead": ["1.125rem", { lineHeight: "1.6" }],
            },
            // Motion design tokens (Sprint 5). Additive — a shared vocabulary of
            // easings/durations for new components so animation feels consistent.
            transitionTimingFunction: {
                smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
                "bounce-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)",
            },
            transitionDuration: {
                "250": "250ms",
                "400": "400ms",
            },
        },
    },
    plugins: [],
} satisfies Config;
