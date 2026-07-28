import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from './ThemeContext'
import { MidiProvider } from './MidiContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MidiProvider>
        <App />
      </MidiProvider>
    </ThemeProvider>
  </StrictMode>,
)