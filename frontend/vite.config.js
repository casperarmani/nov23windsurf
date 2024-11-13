import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/auth_status': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      },
      '/login': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      },
      '/logout': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      },
      '/send_message': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      },
      '/chat_history': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      },
      '/video_analysis_history': {
        target: 'http://0.0.0.0:3100',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true,
    manifest: true
  }
})
