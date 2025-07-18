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
      '^/mcp$': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for SSE
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('MCP proxy error:', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('MCP proxy request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('MCP proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/mcp/token': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('MCP token proxy request:', req.method, req.url);
          });
        },
      },
      '/mcp/test': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('MCP test proxy request:', req.method, req.url);
          });
        },
      },
      '/mcp/device': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('MCP device proxy request:', req.method, req.url);
          });
        },
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('API proxy request:', req.method, req.url);
          });
        },
      },
      '/.well-known': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('OAuth discovery proxy request:', req.method, req.url);
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
