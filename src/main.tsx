import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Request persistent storage to protect IndexedDB on iOS Safari
try {
  if (navigator.storage?.persist) {
    navigator.storage.persist()
  }
} catch {
  // Storage API not available or denied — non-critical
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
