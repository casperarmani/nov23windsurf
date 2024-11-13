import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/auth_status': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/login': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/logout': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/send_message': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/chat_history': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/video_analysis_history': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
