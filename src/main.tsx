import '../instrument.ts'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <>
    <App />
  </>,
)

// Handle HMR (Hot Module Replacement) gracefully to prevent stale module references
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // When HMR updates occur, log but don't crash on errors
    console.log('[HMR] Module updated')
  })
  
  // Handle HMR errors gracefully
  import.meta.hot.on('vite:error', (error) => {
    console.error('[HMR] Error during hot update:', error)
    // Optionally reload the page on critical HMR errors
    if (error.message?.includes('is not defined')) {
      console.warn('[HMR] Detected undefined reference, considering full reload')
      // Uncomment the line below to auto-reload on undefined references
      // window.location.reload()
    }
  })
}
