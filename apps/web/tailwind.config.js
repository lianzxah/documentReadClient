/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'vs-bg': '#1e1e1e',
        'vs-sidebar': '#252526',
        'vs-activity': '#333333',
        'vs-border': '#3c3c3c',
        'vs-panel': '#1e1e1e',
        'vs-status': '#007acc',
        'vs-fg': '#cccccc',
        'vs-muted': '#858585',
        'vs-accent': '#0e639c',
        'vs-accent-hover': '#1177bb',
        'vs-selection': '#264f78',
      },
      fontFamily: {
        mono: ['Consolas', 'Menlo', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
