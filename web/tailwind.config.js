/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Deep dark terminal background
        foreground: '#fafafa', // Light text
        primary: '#3b82f6', // Subtle blue accent
        border: '#27272a',
        muted: '#18181b',
        mutedForeground: '#a1a1aa'
      }
    },
  },
  plugins: [
    import('@tailwindcss/typography'),
  ],
}
