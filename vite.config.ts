import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), 
    react(),
    // Bundle analyzer (only in build mode)
    ...(process.env.ANALYZE ? [visualizer({ 
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })] : [])
  ],
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendor libraries into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            if (id.includes('@monaco-editor')) {
              return 'monaco';
            }
            if (id.includes('@sentry')) {
              return 'sentry';
            }
            if (id.includes('react-markdown') || id.includes('rehype-') || id.includes('remark-')) {
              return 'markdown';
            }
            // Group other vendor packages
            return 'vendor';
          }
          
          // Split large component features
          if (id.includes('AIAssistant') || id.includes('AIGenerate') || id.includes('ChatInterface') || id.includes('MVPBuilder')) {
            return 'ai-features';
          }
          if (id.includes('Monaco') || id.includes('SimpleMarkdown')) {
            return 'editor-features';
          }
        }
      }
    },
    // Enable compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    },
    // Enable tree shaking
    treeshake: true,
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable sourcemap for better debugging in production
    sourcemap: false
  }
}
)
