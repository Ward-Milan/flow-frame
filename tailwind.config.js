/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: "var(--color-brand)",
        accent: "var(--accent)",
        cinema: {
          bg: "#1A120E",
          card: "#3A2418",
          surface: "#261810",
          hover: "#6B4A2E",
          accent: "#A88462",
          text: "#D5C4AE",
          border: "#4A4A46"
        }
      },
    },
  },
  plugins: [],
};
