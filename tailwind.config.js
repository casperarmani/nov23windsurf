/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./static/**/*.{js,css}"
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--p) / <alpha-value>)',
        'primary-focus': 'hsl(var(--pf) / <alpha-value>)',
        'primary-content': 'hsl(var(--pc) / <alpha-value>)',
        
        secondary: 'hsl(var(--s) / <alpha-value>)',
        'secondary-focus': 'hsl(var(--sf) / <alpha-value>)',
        'secondary-content': 'hsl(var(--sc) / <alpha-value>)',
        
        accent: 'hsl(var(--a) / <alpha-value>)',
        'accent-focus': 'hsl(var(--af) / <alpha-value>)',
        'accent-content': 'hsl(var(--ac) / <alpha-value>)',
        
        neutral: 'hsl(var(--n) / <alpha-value>)',
        'neutral-focus': 'hsl(var(--nf) / <alpha-value>)',
        'neutral-content': 'hsl(var(--nc) / <alpha-value>)',
        
        'base-100': 'hsl(var(--b1) / <alpha-value>)',
        'base-200': 'hsl(var(--b2) / <alpha-value>)',
        'base-300': 'hsl(var(--b3) / <alpha-value>)',
        'base-content': 'hsl(var(--bc) / <alpha-value>)',
        
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
    themes: ["light", "dark"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
    themeRoot: ":root",
  },
}