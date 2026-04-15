/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0f0f13',
          card: '#1a1a24',
          column: '#12121a',
          header: '#0d0d12',
        }
      },
      animation: {
        'spin': 'spin 0.8s linear infinite',
      }
    },
  },
  plugins: [],
}
