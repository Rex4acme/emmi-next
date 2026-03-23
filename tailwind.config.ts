// tailwind.config.ts — Tailwind CSS configuration
// Defines the EMMI design system: colours, fonts, and custom tokens
import type { Config } from 'tailwindcss';

const config: Config = {
  // Only include classes actually used in these directories (reduces bundle size)
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // EMMI brand colours — dark industrial palette with amber accent
      colors: {
        base:    '#0b0f14', // darkest background
        surface: '#13181f', // page background
        card:    '#1a2030', // card/panel background
        border:  '#252d3d', // subtle borders
        amber:   '#f0a500', // primary brand accent
        red:     '#f85149', // faults / danger
        green:   '#34d058', // success / resolved
        blue:    '#4a9eff', // info / activities
        purple:  '#a371f7', // AI features
        text: {
          DEFAULT: '#e6edf3', // primary text
          2:       '#8b949e', // secondary text
          3:       '#484f58', // muted text
        },
      },
      // Font families — loaded via next/font in layout.tsx
      fontFamily: {
        display: ['var(--font-display)'], // Syne — headings
        body:    ['var(--font-body)'],    // DM Sans — body
        mono:    ['var(--font-mono)'],    // JetBrains Mono — IDs/values
      },
      // Border radius tokens
      borderRadius: {
        sm:  '6px',
        DEFAULT: '8px',
        lg:  '12px',
        xl:  '16px',
        '2xl': '20px',
      },
      // Animation for loading dots, fade-in etc.
      keyframes: {
        dotPulse: {
          '0%, 80%, 100%': { transform: 'scale(0.5)', opacity: '0.4' },
          '40%':            { transform: 'scale(1)',   opacity: '1'   },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
      },
      animation: {
        'dot-pulse':  'dotPulse 1s infinite ease-in-out',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
      },
    },
  },
  plugins: [],
};

export default config;
