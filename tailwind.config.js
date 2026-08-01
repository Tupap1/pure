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
      colors: {
        background: '#070a12',
        surface: {
          DEFAULT: 'rgba(15, 23, 42, 0.75)',
          hover: 'rgba(30, 41, 59, 0.85)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        aeroespacial: {
          DEFAULT: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.3)',
        },
        software: {
          DEFAULT: '#a855f7',
          glow: 'rgba(168, 85, 247, 0.3)',
        },
        synergy: {
          DEFAULT: '#10b981',
          glow: 'rgba(16, 185, 129, 0.3)',
        },
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
