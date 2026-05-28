import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: { 50: '#fdf8f0', 100: '#f7edd6', 200: '#eedcb0' },
        stone: { 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917' },
        gold: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
      },
    },
  },
  plugins: [],
} satisfies Config;
