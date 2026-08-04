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
        sans: ['var(--font-sans)', 'Inter', 'sans-serif'],
        heading: ['var(--font-heading)', 'Space Grotesk', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
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
          glow: 'rgba(56, 189, 248, 0.25)',
        },
        software: {
          DEFAULT: 'var(--accent-software)',
          glow: 'rgba(192, 132, 252, 0.25)',
        },
        synergy: {
          DEFAULT: 'var(--accent-synergy)',
          glow: 'rgba(52, 211, 153, 0.25)',
        },
        obsidian: {
          950: '#07090e',
          900: '#0d121d',
          850: '#111726',
          800: '#172033',
          700: '#1e293d',
          600: '#33415e',
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
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(52, 211, 153, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(52, 211, 153, 0.5)' },
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

