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
        // CookAI Brand Colors
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // Main orange
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        secondary: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF', // Electric teal
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
        },
        coral: {
          50: '#FFF5F5',
          100: '#FFE5E5',
          200: '#FFCCCC',
          300: '#FFA8A8',
          400: '#FF7B7B',
          500: '#FF6B6B', // Coral accent
          600: '#FA5252',
          700: '#F03E3E',
          800: '#E03131',
          900: '#C92A2A',
        },
        cream: '#FFFBF5',
        warmWhite: '#FDF8F3',
        charcoal: '#2D3436',
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
