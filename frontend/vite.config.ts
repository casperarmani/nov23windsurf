import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://0.0.0.0:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ws/, '')
      }
    },
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})
