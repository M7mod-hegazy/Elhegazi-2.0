import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { preloadTheme } from './lib/themeInit'

// Preload theme immediately before React renders
preloadTheme();

createRoot(document.getElementById("root")!).render(<App />);
