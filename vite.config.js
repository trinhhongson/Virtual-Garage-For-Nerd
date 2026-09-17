import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Import the new Tailwind v4 Vite plugin
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add it right here
  ],

  base: '/Virtual-Garage-For-Nerd/', // Add this line for GitHub Pages
})