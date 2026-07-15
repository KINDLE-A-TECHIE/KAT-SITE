import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
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
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // KAT brand. Values track the :root tokens in globals.css, which are the
        // source of truth; these keys exist so `bg-kat-clay` etc. work in Tailwind.
        kat: {
          ink: "#1A1714",
          clay: "#B2401D",
          "clay-deep": "#8F3316",
          sun: "#F2B705",
          paper: "#F4EEE2",
          pine: "#1F5C4A",
          raised: "#FBF7F0",
          border: "#E0D5C3",
          muted: "#6E6459",

          // Deprecated aliases (retired blue names), repointed onto the warm palette
          // so unconverted surfaces render on-brand rather than blue. Do not use in
          // new code; the design-tokens test rejects them in src/components/marketing.
          dark: "#1A1714",
          navy: "#1A1714",
          blue: "#B2401D",
          light: "#F2B705",
          surface: "#FBF7F0",
          background: "#F4EEE2",
          text: "#1A1714",
          "text-secondary": "#6E6459",
          success: "#1F5C4A",
          warning: "#8A6A00",
          danger: "#B3261E",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        // Warm-tinted shadows. A neutral/blue-black shadow on paper reads grey and dirty.
        'kat': '0 4px 20px -2px rgba(26, 23, 20, 0.10)',
        'kat-lg': '0 10px 40px -4px rgba(26, 23, 20, 0.14)',
      },
      fontFamily: {
        // The faces are loaded via next/font in layout.tsx, which sets the underlying
        // --font-* vars. Never list Inter/Geist/Poppins here: falling back to a default
        // grotesk is precisely how this brand loses its voice.
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Georgia', 'serif'],
        serif: ['var(--font-body)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        // Build-log marquee. The track renders its content twice, so translating by
        // exactly -50% lands on the identical second copy and the loop is seamless.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-in": "slide-in 0.4s ease-out forwards",
        marquee: "marquee 42s linear infinite",
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
