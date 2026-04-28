import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const buildTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Remove console.log in production
          ['transform-remove-console', { exclude: ['error', 'warn'] }]
        ]
      }
    }),
    tailwindcss()
  ],
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].${buildTime}.js`,
        chunkFileNames: `assets/[name].${buildTime}.js`,
        assetFileNames: `assets/[name].${buildTime}.[ext]`,
        manualChunks(id) {
          // Core React libraries
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // Charts (heavy library)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Admin pages (lazy loaded)
          if (id.includes('src/pages/Admin/')) {
            return 'admin-pages';
          }
          // Dashboard pages (lazy loaded)
          if (id.includes('src/pages/Dashboard/')) {
            return 'dashboard-pages';
          }
          // Campaign pages (lazy loaded)
          if (id.includes('src/pages/Campaigns/')) {
            return 'campaign-pages';
          }
          // Other vendor libraries
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: []
  }
})


