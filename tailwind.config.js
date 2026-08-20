/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        display: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'var(--bg-main)',
        surface: {
          DEFAULT: 'var(--bg-card)',
          subtle: 'var(--bg-surface-subtle)',
          hover: 'var(--border-hover)',
          border: 'var(--border-color)',
        },
        aeroespacial: {
          DEFAULT: 'var(--accent-aero)',
          glow: 'rgba(82, 156, 202, 0.12)',
        },
        software: {
          DEFAULT: 'var(--accent-software)',
          glow: 'rgba(154, 109, 215, 0.12)',
        },
        synergy: {
          DEFAULT: 'var(--accent-synergy)',
          glow: 'rgba(82, 158, 114, 0.12)',
        },
        obsidian: {
          950: '#161616',
          900: '#191919',
          850: '#1d1d1d',
          800: '#202020',
          700: '#252525',
          600: '#2f2f2f',
        },
      },
      borderRadius: {
        '2xl': '1rem',      /* 16px - Hero/modals */
        'xl': '0.75rem',    /* 12px - Cards/containers */
        'lg': '0.5rem',     /* 8px - Buttons/inputs */
        'md': '0.25rem',    /* 4px - Badges/micro elements */
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.4s infinite ease-in-out',
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

