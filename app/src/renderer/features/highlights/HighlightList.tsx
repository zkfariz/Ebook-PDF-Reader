import type { Highlight } from '@shared/schemas'

interface HighlightListProps {
  highlights: Highlight[] // already in book order
  missing: ReadonlySet<string>
  describe: (h: Highlight) => string
  onSelect: (h: Highlight) => void
}

const QUOTE_LENGTH = 150

/** F11/F12: every highlight in book order: colour, quote, where, and the note if there is one. */
export function HighlightList({ highlights, missing, describe, onSelect }: HighlightListProps) {
  if (highlights.length === 0)
    return <p className="sidebar-empty">No highlights yet. Select text in the book to highlight it.</p>
  return (
    <ul className="highlights" aria-label="Highlights">
      {highlights.map((h) => {
        const quote = h.text.replace(/\s+/g, ' ').trim()
        return (
          <li key={h.id}>
            <button className={`highlight-item hl-bar-${h.color}`} onClick={() => onSelect(h)}>
              <span className="highlight-quote">
                “{quote.length > QUOTE_LENGTH ? `${quote.slice(0, QUOTE_LENGTH)}…` : quote}”
              </span>
              {h.note && <span className="highlight-note">✎ {h.note}</span>}
              <span className="highlight-where">
                {describe(h)}
                {missing.has(h.id) && <span className="highlight-missing"> · ⚠ couldn't find on page</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
