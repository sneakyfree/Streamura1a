import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5852,
    host: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.trycloudflare.com', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
