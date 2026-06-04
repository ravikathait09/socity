/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3b6fff",
          600: "#2f5ae0",
          700: "#2748b3",
        },
      },
    },
  },
  plugins: [],
};
