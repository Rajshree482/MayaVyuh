import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // ⚠️  Keep this as '/MayaVyuh/' for GitHub Pages deployment.
  // For local dev (npm run dev) Vite handles it automatically.
  // If you later deploy to a custom domain root, change to '/'.
  base: '/MayaVyuh/',

  resolve: {
    alias: {
      // Lets you import '@/useSync' instead of '../../useSync' from anywhere
      '@': resolve(__dirname, './src'),
    },
  },

  build: {
    // Increase warning limit — our single-file approach is intentional
    chunkSizeWarningLimit: 1200,
  },

  // Dev server tweaks
  server: {
    port: 5173,
    open: true,
  },
})