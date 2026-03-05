/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Foco cirúrgico na pasta src para performance
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-to': 'var(--brand-to)',
        bg: 'var(--bg-main)',
        surface: 'var(--bg-surface)',
        sidebar: 'var(--bg-sidebar)',
        text: 'var(--text-main)',
        'text-sec': 'var(--text-sec)',
        border: 'var(--border-color)',
      },
      fontFamily: {
        // Preservamos o padrão Google/Inter e a fonte Gothic para títulos
        sans: ['"Google Sans"', 'Inter', 'sans-serif'],
        gothic: ['"Pirata One"', 'cursive'],
      },
      transitionProperty: {
        'colors': 'background-color, border-color, color, fill, stroke',
      }
    },
  },
  plugins: [],
}