import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lightsync-mobile.css'
import './styles/lightsync.css'
import './styles/theme.css'
import './styles/pro-ui.css'
import './styles/sports-pro.css'
import './styles/mobile-pro.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)