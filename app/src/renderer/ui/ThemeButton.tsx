import type { Theme } from '@shared/ipc'

/** ☀/☾ toggle used in both toolbars (F08). */
export function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const label = theme === 'day' ? 'Switch to night mode' : 'Switch to day mode'
  return (
    <button onClick={onToggle} aria-label={label} title={`${label} (Ctrl+Shift+N)`}>
      {theme === 'day' ? '☾' : '☀'}
    </button>
  )
}
