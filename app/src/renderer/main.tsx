import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './app/App'
import { applyTheme, loadStartup } from './app/theme'

// Apply the theme before the first paint, so a night-mode user never sees a flash of day colours.
void loadStartup().then((startup) => {
  applyTheme(startup.theme)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App startup={startup} />
    </StrictMode>
  )
})
