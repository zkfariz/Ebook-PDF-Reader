// All keyboard shortcuts in one table (spec: "Keyboard shortcuts"). Later slices add rows.

export type ShortcutAction =
  | 'open'
  | 'library'
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'goto'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'down-or-next' // ↓: scroll, or next page at the bottom edge
  | 'up-or-prev' // ↑: scroll, or previous page at the top edge
  | 'toggle-theme'
  | 'fullscreen'
  | 'escape'
  | 'toggle-sidebar'
  | 'bookmark'
  | 'search'

interface Shortcut {
  action: ShortcutAction
  keys: string[] // KeyboardEvent.key values
  ctrl?: boolean
  alt?: boolean
  shift?: boolean // undefined = either
}

const SHORTCUTS: Shortcut[] = [
  { action: 'open', keys: ['o', 'O'], ctrl: true },
  { action: 'library', keys: ['ArrowLeft'], alt: true },
  { action: 'library', keys: ['l', 'L'], ctrl: true },
  { action: 'next', keys: ['ArrowRight', 'PageDown'] },
  { action: 'next', keys: [' '], shift: false },
  { action: 'prev', keys: ['ArrowLeft', 'PageUp'] },
  { action: 'prev', keys: [' '], shift: true },
  { action: 'first', keys: ['Home'] },
  { action: 'last', keys: ['End'] },
  { action: 'goto', keys: ['g', 'G'], ctrl: true },
  { action: 'zoom-in', keys: ['=', '+'], ctrl: true },
  { action: 'zoom-out', keys: ['-', '_'], ctrl: true },
  { action: 'zoom-reset', keys: ['0'], ctrl: true },
  { action: 'down-or-next', keys: ['ArrowDown'] },
  { action: 'up-or-prev', keys: ['ArrowUp'] },
  { action: 'toggle-theme', keys: ['n', 'N'], ctrl: true, shift: true },
  { action: 'fullscreen', keys: ['F11'] },
  { action: 'escape', keys: ['Escape'] },
  { action: 'bookmark', keys: ['b', 'B'], ctrl: true },
  { action: 'search', keys: ['f', 'F'], ctrl: true },
  { action: 'toggle-sidebar', keys: ['\\'], ctrl: true }
]

/** True when the user is typing, so plain keys must not trigger reader shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export function matchShortcut(e: KeyboardEvent): ShortcutAction | null {
  if (isTypingTarget(e.target)) return null
  const hit = SHORTCUTS.find(
    (s) =>
      s.keys.includes(e.key) &&
      !!s.ctrl === e.ctrlKey &&
      !!s.alt === e.altKey &&
      (s.shift === undefined || s.shift === e.shiftKey) &&
      !e.metaKey
  )
  return hit?.action ?? null
}
