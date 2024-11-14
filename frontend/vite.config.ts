import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/types': path.resolve(__dirname, './src/types')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/chat_history': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/video_analysis_history': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      },
      '/auth_status': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true
      }
    }
  }
})
