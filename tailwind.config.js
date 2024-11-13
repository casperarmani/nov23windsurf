/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./static/**/*.{js,css}"
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },
    extend: {
      colors: {
        primary: 'hsl(var(--p) / <alpha-value>)',
        secondary: 'hsl(var(--s) / <alpha-value>)',
        accent: 'hsl(var(--a) / <alpha-value>)',
        neutral: 'hsl(var(--n) / <alpha-value>)',
        'base-100': 'hsl(var(--b1) / <alpha-value>)',
        'base-200': 'hsl(var(--b2) / <alpha-value>)',
        'base-300': 'hsl(var(--b3) / <alpha-value>)',
        info: 'hsl(var(--in) / <alpha-value>)',
        success: 'hsl(var(--su) / <alpha-value>)',
        warning: 'hsl(var(--wa) / <alpha-value>)',
        error: 'hsl(var(--er) / <alpha-value>)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui')
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake", "cyberpunk"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    logs: false,
    rtl: false,
  }
}
