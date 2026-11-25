/** @type {import('tailwindcss').Config} */
// Design tokens. Idea: a calm, trustworthy "petrol" (brand) on a cool, quiet surface, with one warm amber "beacon"
// (accent) reserved for the moments that need attention: the headline highlight, unread count, match score.
// Lost = brick red, found = green, always paired with a text label (never colour alone).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#081822', 900: '#0D2434', 800: '#16364A', 700: '#244B63', 600: '#3C6178' },
        brand: { 50: '#EEF7F8', 100: '#D6ECEE', 200: '#AAD7DB', 300: '#74BDC4', 400: '#3E9FAA', 500: '#1A8794', 600: '#0F7280', 700: '#0B5B67', 800: '#0A4752' },
        accent: { 100: '#FDEFCB', 300: '#F9CE6B', 400: '#F6B93B', 500: '#EE9F14', 600: '#C77F08' },
        surface: '#F4F7F9',
        lost: { bg: '#FCE9E6', text: '#9B2A1B' },
        found: { bg: '#E2F4E9', text: '#14653A' },
      },
      borderRadius: { card: '14px' },
      boxShadow: {
        card: '0 1px 2px rgb(13 36 52 / 0.06), 0 1px 1px rgb(13 36 52 / 0.04)',
        lift: '0 8px 24px -8px rgb(13 36 52 / 0.18), 0 2px 6px rgb(13 36 52 / 0.06)',
      },
      maxWidth: { content: '1152px' },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'ui-sans-serif', 'sans-serif'],
        arabic: ['"Noto Sans Arabic"', '"Segoe UI"', 'Tahoma', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
