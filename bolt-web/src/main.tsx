import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from './ThemeContext'
import { MidiProvider } from './MidiContext'
import { InterfaceProvider, useInterface } from './InterfaceContext'
import App from './App.tsx'
import MobileApp from './MobileApp.tsx'

function Root() {
  const { interfaceMode } = useInterface()
  return interfaceMode === 'mobile' ? <MobileApp /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MidiProvider>
        <InterfaceProvider>
          <Root />
        </InterfaceProvider>
      </MidiProvider>
    </ThemeProvider>
  </StrictMode>,
)
