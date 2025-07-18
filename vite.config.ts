import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // API endpoints - proxy to main server
      '^/api/.*': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('API proxy request:', req.method, req.url);
          });
        },
      },
    },
  },
  // Remove or comment out these warning suppressions and fix the underlying issues:
  // esbuild: {
  //   logOverride: { 'this-is-undefined-in-esm': 'silent' }
  // },
  // build: {
  //   rollupOptions: {
  //     onwarn(warning, warn) {
  //       if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
  //       warn(warning)
  //     }
  //   }
  // }
  }
)
