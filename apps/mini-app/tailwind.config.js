/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          darkest: '#05080f',
          dark: '#070e1b',
          DEFAULT: '#0b1324',
          light: '#0f1f3a',
        },
        royal: {
          DEFAULT: '#1e3a8a',
          bright: '#2563eb',
          light: '#3b82f6',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e8c45a',
          dark: '#b8861b',
          pale: '#f4e5a8',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        cyan: '#22d3ee',
        violet: '#8b5cf6',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.5)',
        panel: '0 8px 32px rgba(0,0,0,0.6)',
        gold: '0 0 24px rgba(212,175,55,0.35)',
        table: '0 24px 64px rgba(0,0,0,0.9)',
        inset_gold:
          'inset 0 1px 0 rgba(255,235,170,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },
    },
  },
  plugins: [],
};