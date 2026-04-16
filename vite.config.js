import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const buildTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].${buildTime}.js`,
        chunkFileNames: `assets/[name].${buildTime}.js`,
        assetFileNames: `assets/[name].${buildTime}.[ext]`,
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
})

