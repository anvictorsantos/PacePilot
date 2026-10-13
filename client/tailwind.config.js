/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#F97316',
        primaryBright: '#FB923C',
        background: '#0B0B0F',
        card: '#141419',
        cardSecondary: '#1A1A21',
        muted: '#A1A1AA',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        border: '#27272A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
