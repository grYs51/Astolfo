const colors = require('tailwindcss/colors');

// IMPORTANT: everything lives under `theme.extend` — overriding `theme.colors`
// or `theme.spacing` outright removes the default scales (gray-*, w-10, p-6, …)
// that the component templates rely on.
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: colors.purple,
        secondary: colors.sky,
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
      },
    },
  },
  daisyui: {
    themes: [
      {
        astolfo: {
          primary: '#a855f7',
          'primary-content': '#ffffff',
          secondary: '#38bdf8',
          'secondary-content': '#082f49',
          accent: '#f472b6',
          neutral: '#1f2937',
          'base-100': '#0d0f14', // page background
          'base-200': '#1a2030', // inner surfaces (list items, chart wells)
          'base-300': '#141824', // cards
          'base-content': '#e5e7eb',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
    ],
    logs: false,
  },
  plugins: [require('daisyui')],
};
