import { Menu } from 'electron'

// Production: no application menu at all (all actions live in the app toolbar).
// Development: a tiny menu so reload and DevTools stay one keypress away.
export function setAppMenu(isDev: boolean): void {
  if (!isDev) {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Dev',
        submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }]
      }
    ])
  )
}
