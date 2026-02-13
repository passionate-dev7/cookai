/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // CookAI Brand Colors – Sage & Terracotta
        primary: {
          50: '#E8EDE4',
          100: '#D5DFD0',
          200: '#B8CCAE',
          300: '#9AB88E',
          400: '#7D9E6E',
          500: '#6B7F5E', // Sage green
          600: '#5C6E50',
          700: '#4D5D43',
          800: '#3D4A36',
          900: '#2E3829',
          950: '#1F261C',
        },
        secondary: {
          50: '#F5EDE6',
          100: '#EBDACC',
          200: '#D6B599',
          300: '#C29066',
          400: '#A07A55',
          500: '#8B6F4E', // Warm brown
          600: '#7A6340',
          700: '#605034',
          800: '#4A3D28',
          900: '#352C1D',
          950: '#1F1A11',
        },
        accent: {
          50: '#F5E1D6',
          100: '#EFCFBD',
          200: '#E3AE93',
          300: '#D4885F',
          400: '#C4704B', // Terracotta
          500: '#B0613F',
          600: '#9A5336',
          700: '#7D432C',
          800: '#603322',
          900: '#432318',
          950: '#26140E',
        },
        cream: '#FAF8F5',
        warmWhite: '#F3F0EB',
        charcoal: '#2C2825',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['ClashDisplay', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
