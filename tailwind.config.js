/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crypto: {
          dark: '#0b0e11',
          card: '#151a1f',
          accent: '#3b82f6',
          up: '#00c087',
          down: '#f23645',
          text: '#d1d5db',
          muted: '#6b7280'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'market-sans', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}