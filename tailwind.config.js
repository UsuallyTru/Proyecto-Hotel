/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: '#0b0f14',
        ink: '#111827',
        graysoft: '#cbd5e1',
        champagne: '#e8d8b1',
        surface: '#0e1319',
        surface2: '#141a22',
        border: 'rgba(255,255,255,0.06)'
      },
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem',
        },
        screens: {
          '2xl': '80rem',
        },
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'brand-sm': '0 6px 16px rgba(0,0,0,0.12)',
        brand: '0 10px 30px rgba(0,0,0,0.18)',
        elevated: '0 12px 32px rgba(0,0,0,0.22)',
      },
    },
  },
  plugins: [],
}
