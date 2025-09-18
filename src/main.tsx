import '../instrument.ts'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Preload critical CSS that we need for first paint
const preloadCSS = () => {
  // Dynamically import highlight.js styles only when needed
  import('highlight.js/styles/github-dark.css')
}

// Call preload function to start loading non-critical CSS
preloadCSS()

createRoot(document.getElementById('root')!).render(
  <>
    <App />
  </>,
)
