import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error handlers to prevent unhandled errors from crashing the app
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection (suppressed):', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.warn('Global error (suppressed):', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
