import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { Anchor, Highlight } from '@shared/schemas'
import type { ReaderAdapter } from '../../reader/ReaderAdapter'
import type { BookSession } from '../reader/BookSession'

export type HlColor = Highlight['color']
export const HL_COLORS: HlColor[] = ['yellow', 'green', 'blue', 'pink']

/** Location to jump to for an anchor (the page for PDF, the CFI for EPUB). */
export const anchorLoc = (a: Anchor) => (a.kind === 'pdf' ? `pdf:p=${a.page}` : a.cfi)

/**
 * Highlights of the open book (F11, notes F12): the list in book order, add/recolour/delete,
 * keeping the adapter's drawing and the saved data in step.
 */
export function useHighlights(adapterRef: RefObject<ReaderAdapter | null>, sessionRef: RefObject<BookSession | null>) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set())

  /** Call once the book's saved data has loaded. */
  const load = useCallback(() => setHighlights(sessionRef.current?.highlights ?? []), [sessionRef])

  // Whatever the list is, that is what is drawn.
  useEffect(() => {
    adapterRef.current?.setHighlights(
      highlights.map((h) => ({ id: h.id, anchor: h.anchor, text: h.text, color: h.color, note: h.note, hasNote: !!h.note }))
    )
  }, [highlights, adapterRef])

  const add = useCallback(
    (anchor: Anchor, text: string, color: HlColor): Highlight | undefined => {
      const list = sessionRef.current?.addHighlight(anchor, text, color)
      if (list) setHighlights(list)
      return list?.[list.length - 1]
    },
    [sessionRef]
  )

  const update = useCallback(
    (id: string, patch: Parameters<BookSession['updateHighlight']>[1]) => {
      const list = sessionRef.current?.updateHighlight(id, patch)
      if (list) setHighlights(list)
    },
    [sessionRef]
  )

  const remove = useCallback(
    (id: string) => {
      const list = sessionRef.current?.removeHighlight(id)
      if (list) setHighlights(list)
    },
    [sessionRef]
  )

  /** The adapter found a highlight's text at new offsets (PDF): save them, quietly. */
  const repaired = useCallback((id: string, anchor: Anchor) => update(id, { anchor }), [update])
  const notFound = useCallback((id: string) => setMissing((prev) => new Set(prev).add(id)), [])

  const sorted = useMemo(() => {
    const adapter = adapterRef.current
    return [...highlights].sort((a, b) => {
      if (a.anchor.kind === 'pdf' && b.anchor.kind === 'pdf')
        return a.anchor.page - b.anchor.page || a.anchor.start - b.anchor.start
      return adapter ? adapter.compareLocs(anchorLoc(a.anchor), anchorLoc(b.anchor)) : 0
    })
  }, [highlights, adapterRef])

  return { highlights: sorted, missing, load, add, update, remove, repaired, notFound }
}
