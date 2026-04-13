import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base URL is injected by GitHub Actions as the repo name (/<repo>/)
// Falls back to '/' for local dev
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/',
})
