import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './theme/ThemeProvider'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'

const UseHash = typeof window !== 'undefined' && /github\.io$/i.test(window.location.host)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {UseHash ? (
      <HashRouter>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </HashRouter>
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
)
