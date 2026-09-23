import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from '@/App'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useSettingsStore } from '@/store/settingsStore'

document.documentElement.lang = useSettingsStore.getState().language

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
