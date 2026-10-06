import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export const NOTE_MAX = 5000 // spec F12: plain text, up to 5,000 characters

interface NoteEditorProps {
  /** Window rectangle of the highlighted text, to place the editor next to it. */
  rect: DOMRect
  initial: string
  onSave: (note: string) => void
  onCancel: () => void
}

const WIDTH = 320
const HEIGHT = 180

/** F12: small box to write or edit a highlight's note. Ctrl+Enter saves, Esc cancels. */
export function NoteEditor({ rect, initial, onSave, onCancel }: NoteEditorProps) {
  const [text, setText] = useState(initial)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const box = boxRef.current
    box?.focus()
    box?.setSelectionRange(box.value.length, box.value.length) // cursor at the end of an existing note
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      onSave(text)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  // Above the text if there is room, otherwise below it; always inside the window.
  const top = rect.top > HEIGHT + 20 ? rect.top - HEIGHT - 10 : Math.min(rect.bottom + 10, window.innerHeight - HEIGHT - 8)
  const left = Math.min(Math.max(rect.left + rect.width / 2 - WIDTH / 2, 8), window.innerWidth - WIDTH - 8)

  return (
    <div className="note-editor" role="dialog" aria-label="Note" style={{ top, left, width: WIDTH }}>
      <textarea
        ref={boxRef}
        aria-label="Note text"
        value={text}
        maxLength={NOTE_MAX}
        placeholder="Write a note…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="note-actions">
        <span className="note-hint">{text.length > NOTE_MAX - 500 ? `${text.length} / ${NOTE_MAX}` : 'Ctrl+Enter to save'}</span>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={() => onSave(text)}>
          Save
        </button>
      </div>
    </div>
  )
}
