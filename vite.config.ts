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
      // MCP main endpoint with SSE support
      '^/mcp$': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for SSE
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('MCP proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('MCP proxy request:', req.method, req.url);
            // Add proxy headers for backend detection
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:5173');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('MCP proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // MCP sub-endpoints
      '^/mcp/.*': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('MCP sub-endpoint proxy request:', req.method, req.url);
            // Add proxy headers for backend detection
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:5173');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('MCP sub-endpoint proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // API endpoints
      '^/api/.*': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('API proxy request:', req.method, req.url);
          });
        },
      },
      // OAuth discovery endpoints
      '^/\\.well-known/.*': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('OAuth discovery proxy request:', req.method, req.url);
            // Add proxy headers for backend detection
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:5173');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
        },
      },
      // Client registration endpoint
      '^/register': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Client registration proxy request:', req.method, req.url);
            // Add proxy headers for backend detection
            proxyReq.setHeader('X-Forwarded-Host', 'localhost:5173');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
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
