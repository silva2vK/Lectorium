/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /^(bg|border|text|ring)-(violet|indigo|slate|blue|green|red|pink|orange|purple|yellow)-(400|500|600|700|800|900)$/ },
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-to': 'var(--brand-to)', // Cor secundária para degradês
        bg: 'var(--bg-main)',
        surface: 'var(--bg-surface)',
        sidebar: 'var(--bg-sidebar)',
        text: 'var(--text-main)',
        'text-sec': 'var(--text-sec)',
        border: 'var(--border-color)',
      },
      fontFamily: {
        sans: ['"Google Sans"', 'Inter', 'sans-serif'],
      },
      transitionProperty: {
        'colors': 'background-color, border-color, color, fill, stroke',
      }
    },
  },
  plugins: [],
}