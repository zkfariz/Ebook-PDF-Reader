import type { Theme } from '@shared/ipc'
import type { Settings } from '@shared/schemas'

export type SidebarState = Settings['sidebar']

export interface Startup {
  theme: Theme
  sidebar: SidebarState
}

/**
 * Settings needed before the first paint: the saved theme (or, on first launch, the Windows
 * light/dark setting) and the sidebar state, so the reading pane never changes size after a
 * book has been laid out.
 */
export async function loadStartup(): Promise<Startup> {
  const settings = await window.api.settings.get()
  const theme = settings.theme ?? (await window.api.app.systemTheme())
  return { theme, sidebar: settings.sidebar }
}

/** Switches every colour token at once (theme.css keys off this attribute). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
}
