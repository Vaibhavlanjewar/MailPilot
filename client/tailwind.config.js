/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d9efff',
          200: '#bce2ff',
          300: '#8eceff',
          400: '#58b1ff',
          500: '#2f8ff5',
          600: '#1a73e0',
          700: '#155bc4',
          800: '#16499e',
          900: '#18407c',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f8fc',
          border: '#e8ecf4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        elevated: '0 10px 40px -12px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
