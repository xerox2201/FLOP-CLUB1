/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base:     '#0a0e1a',
        surface:  '#131829',
        elevated: '#1a2035',
        gold:     '#f5c842',
        golddark: '#d4a017',
        felt:     '#0a5c36',
        holdem:   '#1e3a8a',
        omaha4:   '#7f1d1d',
        omaha5:   '#14532d',
        tourney:  '#4c1d95',
        good:     '#22c55e',
        bad:      '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(245, 200, 66, 0.35)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}