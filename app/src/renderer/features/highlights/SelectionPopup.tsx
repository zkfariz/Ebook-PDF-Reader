import type { ReactNode } from 'react'
import { HL_COLORS, type HlColor } from './useHighlights'
import './highlights.css'

interface SelectionPopupProps {
  /** Window rectangle of the selected / clicked text. */
  rect: DOMRect
  /** Colour of the clicked highlight (shows as pressed); absent for a new selection. */
  current?: HlColor
  onColor?: (color: HlColor) => void
  children?: ReactNode
}

const WIDTH = 240 // px; used to keep the popup inside the window

/**
 * Small toolbar above the selection (F11): colour dots, then the actions passed as children
 * (Note · Copy for new text, Note · Delete for an existing highlight, or a message).
 */
export function SelectionPopup({ rect, current, onColor, children }: SelectionPopupProps) {
  const above = rect.top > 70
  const top = above ? rect.top - 52 : rect.bottom + 10
  const center = Math.min(Math.max(rect.left + rect.width / 2, WIDTH / 2 + 8), window.innerWidth - WIDTH / 2 - 8)

  return (
    <div
      className="selection-popup"
      role="toolbar"
      aria-label="Highlight"
      style={{ top, left: center }}
      // Keep the text selected while the popup's buttons are pressed.
      onMouseDown={(e) => e.preventDefault()}
    >
      {onColor &&
        HL_COLORS.map((c) => (
          <button
            key={c}
            className={`hl-dot hl-dot-${c}`}
            aria-label={`Highlight ${c}`}
            aria-pressed={current ? c === current : undefined}
            title={`Highlight ${c}`}
            onClick={() => onColor(c)}
          />
        ))}
      {children}
    </div>
  )
}
