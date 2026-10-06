import type { RefObject } from 'react'
import type { ReaderAdapter, TextSelection } from '../../reader/ReaderAdapter'
import { NoteEditor } from './NoteEditor'
import { SelectionPopup } from './SelectionPopup'
import type { useHighlights } from './useHighlights'

export type PopupState =
  | { kind: 'new'; selection: TextSelection }
  | { kind: 'existing'; id: string; rect: DOMRect }
  | { kind: 'note'; id: string; rect: DOMRect }
  | { kind: 'error'; message: string; rect: DOMRect }

interface HighlightPopupProps {
  popup: PopupState
  highlights: ReturnType<typeof useHighlights>
  adapterRef: RefObject<ReaderAdapter | null>
  /** Switch to another popup (e.g. from the colour bar to the note editor). */
  onOpen: (next: PopupState) => void
  onClose: () => void
}

/**
 * What the popup offers (F11, F12): colours · Note · Copy for new text; colours · Note · Delete
 * for an existing highlight; the note editor; or a message for a selection that can't be used.
 */
export function HighlightPopup({ popup, highlights: hl, adapterRef, onOpen, onClose }: HighlightPopupProps) {
  const done = () => {
    adapterRef.current?.clearSelection()
    onClose()
  }

  if (popup.kind === 'error') {
    return (
      <SelectionPopup rect={popup.rect}>
        <span className="popup-message" role="status">
          {popup.message}
        </span>
      </SelectionPopup>
    )
  }

  if (popup.kind === 'new') {
    const { selection } = popup
    return (
      <SelectionPopup
        rect={selection.rect}
        onColor={(color) => {
          hl.add(selection.anchor, selection.text, color)
          done()
        }}
      >
        <button
          onClick={() => {
            // F12: a note on new text first makes it a (yellow) highlight.
            const created = hl.add(selection.anchor, selection.text, 'yellow')
            adapterRef.current?.clearSelection()
            if (created) onOpen({ kind: 'note', id: created.id, rect: selection.rect })
            else onClose()
          }}
        >
          Note
        </button>
        <button onClick={() => void window.api.clipboard.writeText(selection.text).then(done)}>Copy</button>
      </SelectionPopup>
    )
  }

  const existing = hl.highlights.find((h) => h.id === popup.id)
  if (!existing) return null

  if (popup.kind === 'note') {
    return (
      <NoteEditor
        rect={popup.rect}
        initial={existing.note ?? ''}
        onSave={(note) => {
          hl.update(existing.id, { note }) // an empty note removes the note, keeps the highlight (F12.2)
          onClose()
        }}
        onCancel={onClose}
      />
    )
  }

  return (
    <SelectionPopup
      rect={popup.rect}
      current={existing.color}
      onColor={(color) => {
        hl.update(existing.id, { color })
        done()
      }}
    >
      <button onClick={() => onOpen({ kind: 'note', id: existing.id, rect: popup.rect })}>Note</button>
      <button
        onClick={() => {
          hl.remove(existing.id)
          done()
        }}
      >
        Delete
      </button>
    </SelectionPopup>
  )
}
