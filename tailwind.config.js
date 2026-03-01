/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066ff',
          foreground: '#eff6ff',
        },
        background: '#fafbfc',
        foreground: '#0a0e27',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0a0e27',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#0a0e27',
        },
        secondary: {
          DEFAULT: '#f0f3f7',
          foreground: '#3d4556',
        },
        muted: {
          DEFAULT: '#e8ecf1',
          foreground: '#6b7280',
        },
        accent: {
          DEFAULT: '#f0f3f7',
          foreground: '#0a0e27',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#fafafa',
        },
        border: '#e8ecf1',
        input: '#e8ecf1',
        ring: '#0066ff',
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
      fontFamily: {
        sans: ['Sora', 'Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
        'bottom-nav': 'calc(4rem + 0.625rem + env(safe-area-inset-bottom, 0px))', // h-16 + bottom + safe
      },
    },
  },
  plugins: [],
}
