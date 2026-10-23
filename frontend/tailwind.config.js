/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
      },
      colors: {
        soc: {
          primary: "#E11D48",
          dark: "#BE123C",
          light: "#FFF1F2"
        }
      }
    },
  },
  plugins: [],
}
