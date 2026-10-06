import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { PageTextState, Progress, ReaderAdapter } from '../../reader/ReaderAdapter'

export interface OcrView {
  /** What the page on screen offers as text; null for EPUBs and before the first page is ready. */
  state: PageTextState | null
  /** The page being read right now, if any (one at a time). */
  busyPage: number | null
  /** Why the last attempt failed, if it did. */
  error: string | null
  /** Page on screen (1-based). */
  page: number
  recognise: () => void
}

/**
 * Text recognition for scanned PDF pages (F16): tells whether the current page is only a picture,
 * reads it when asked, and saves the result in the app's data folder so it is read only once.
 */
export function useOcr(adapterRef: MutableRefObject<ReaderAdapter | null>, bookId: string, progress: Progress | null): OcrView {
  const [state, setState] = useState<PageTextState | null>(null)
  const [busyPage, setBusyPage] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const page = progress?.current ?? 0
  const pageRef = useRef(page)
  pageRef.current = page

  // Which kind of page is on screen? Asked again at every page change (and when its text changes).
  useEffect(() => {
    const ocr = adapterRef.current?.ocr
    setError(null)
    if (!ocr || page < 1) {
      setState(null)
      return
    }
    let current = true
    void ocr.pageState(page).then((s) => current && setState(s))
    return () => {
      current = false
    }
  }, [adapterRef, page, progress?.total])

  const recognise = useCallback(() => {
    const ocr = adapterRef.current?.ocr
    const n = pageRef.current
    if (!ocr || n < 1 || busyPage !== null) return
    setBusyPage(n)
    setError(null)
    ocr
      .recognise(n)
      .then(async (lines) => {
        await window.api.ocr.putPage(bookId, n, lines) // saved at once: a page is only read once (F16.6)
        if (pageRef.current === n) setState(lines.length > 0 ? 'recognised' : 'blank')
      })
      .catch(() => {
        if (pageRef.current === n) setError("Text recognition isn't available right now.")
      })
      .finally(() => setBusyPage(null))
  }, [adapterRef, bookId, busyPage])

  return { state, busyPage, error, page, recognise }
}
