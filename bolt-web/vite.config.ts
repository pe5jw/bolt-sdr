import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'http://localhost:6061',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:6061',
        changeOrigin: true,
      },
    }
  },
  build: {
    // Output naar wwwroot — wordt door build-dist.ps1 opgepakt als BoltCore wwwroot
    outDir: '../distro/win-x64/wwwroot',
    emptyOutDir: true,
  }
})
