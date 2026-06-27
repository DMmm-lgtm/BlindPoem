/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'night-blue': '#0a0e27',
        'dawn-purple': '#1a1a3e',
        'gold': '#ffd700',
      },
    },
  },
  plugins: [],
}


