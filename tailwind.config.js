/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/client/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-120px) scale(1.4)', opacity: '0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(225, 29, 72, 0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(225, 29, 72, 0.8)' },
        }
      },
      animation: {
        floatUp: 'floatUp 2.5s ease-out forwards',
        pulseGlow: 'pulseGlow 2s infinite',
      }
    },
  },
  plugins: [],
}
