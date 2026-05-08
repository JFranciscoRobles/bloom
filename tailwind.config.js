/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "ink" is repurposed as the app's neutral scale for a light pastel theme.
        // Low numbers = darkest text, high numbers = lightest backgrounds.
        ink: {
          50: '#3d2e5c',
          100: '#4b3a6e',
          200: '#5b4a82',
          300: '#7a6aa0',
          400: '#9d8fbf',
          500: '#b3a7d1',
          600: '#cabfe0',
          700: '#e0d7ee',
          800: '#ede6f7',
          900: '#f5f0fc',
          950: '#faf7ff'
        },
        // Override the few accent ramps used by existing components so they read pastel.
        indigo: {
          400: '#c4b5fd',
          500: '#b8a6f5',
          600: '#a78bfa'
        },
        rose: {
          400: '#fb7185',
          600: '#fda4af',
          700: '#fca5a5'
        },
        emerald: {
          400: '#34d399',
          700: '#a7f3d0'
        },
        pastel: {
          // `purple` and `pink` follow the active board theme via CSS variables.
          // The /<alpha> Tailwind syntax requires a space-separated rgb triplet.
          purple: 'rgb(var(--theme-accent-rgb) / <alpha-value>)',
          pink: 'rgb(var(--theme-soft-rgb) / <alpha-value>)',
          blue: '#93c5fd',
          mint: '#86efac',
          peach: '#fcd5b5',
          lemon: '#fde68a'
        }
      }
    }
  },
  plugins: []
}
