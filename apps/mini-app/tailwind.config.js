/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // FLOP CLUB palette
        navy: '#080d24',
        'dark-blue': '#101a3a',
        purple: {
          DEFAULT: '#6d28d9',
          royal: '#6d28d9',
        },
        violet: {
          DEFAULT: '#8b5cf6',
          electric: '#8b5cf6',
        },
        turquoise: '#19d3c5',
        cyan: '#22d3ee',
        gold: {
          DEFAULT: '#f4c95d',
          dark: '#a87922',
          light: '#ffe9a8',
        },
        'near-black': '#050611',
        'soft-white': '#f4f7ff',

        // Legacy aliases (keep existing components working)
        base: '#080d24',
        surface: '#101a3a',
        elevated: '#18224a',
        golddark: '#a87922',
        felt: '#0a5c36',
        holdem: '#1e3a8a',
        omaha4: '#7f1d1d',
        omaha5: '#14532d',
        tourney: '#4c1d95',
        good: '#22c55e',
        bad: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold': '0 0 20px rgba(244, 201, 93, 0.35)',
        'gold-lg': '0 0 40px rgba(244, 201, 93, 0.5)',
        'cyan': '0 0 20px rgba(34, 211, 238, 0.4)',
        'purple': '0 0 24px rgba(139, 92, 246, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-lg': '0 10px 30px rgba(0, 0, 0, 0.6)',
        'inset-top': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(180deg, #ffe9a8 0%, #f4c95d 50%, #a87922 100%)',
        'gradient-cyan': 'linear-gradient(180deg, #38e6ff 0%, #22d3ee 50%, #0e7f95 100%)',
        'gradient-purple': 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)',
        'felt-radial': 'radial-gradient(ellipse at 50% 45%, #1a5c3a 0%, #0d3d24 55%, #072a1a 100%)',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
  
};