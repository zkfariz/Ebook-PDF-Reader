import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { PageTextState, Progress, ReaderAdapter } from '../../reader/ReaderAdapter'
import { OcrQueue, readingOrder, workerCount } from '../../reader/ocr/OcrQueue'

/** State of a "recognise the whole book" run (F16.3). */
export interface BookRun {
  phase: 'idle' | 'running' | 'finished'
  done: number
  total: number
  failed: number
  /** Finished because the user pressed Cancel. */
  cancelled: boolean
}

const IDLE: BookRun = { phase: 'idle', done: 0, total: 0, failed: 0, cancelled: false }

export interface OcrView {
  /** What the page on screen offers as text; null for EPUBs and before the first page is ready. */
  state: PageTextState | null
  /** The page being read right now by a single-page request, if any. */
  busyPage: number | null
  /** Why the last single-page attempt failed, if it did. */
  error: string | null
  /** Page on screen (1-based). */
  page: number
  /** Pages of this book that already have recognised text. */
  recognisedPages: number
  book: BookRun
  recognise: () => void
  /** Reads every page that is still only a picture; also continues a run that was interrupted. */
  recogniseBook: () => void
  cancelBook: () => void
}

/**
 * Text recognition for scanned PDF pages (F16): tells whether the current page is only a picture,
 * reads it (or the whole book) when asked, and saves every page as soon as it is read, so a page is
 * only read once and an interrupted run keeps what it finished (F16.7).
 */
export function useOcr(adapterRef: MutableRefObject<ReaderAdapter | null>, bookId: string, progress: Progress | null): OcrView {
  const [state, setState] = useState<PageTextState | null>(null)
  const [busyPage, setBusyPage] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recognisedPages, setRecognisedPages] = useState(0)
  const [book, setBook] = useState<BookRun>(IDLE)
  const queueRef = useRef<OcrQueue | null>(null)
  const page = progress?.current ?? 0
  const pageRef = useRef(page)
  pageRef.current = page

  // Which kind of page is on screen? Asked again at every page change (and when its text changes).
  useEffect(() => {
    const ocr = adapterRef.current?.ocr
    setError(null)
    setBook((b) => (b.phase === 'finished' ? IDLE : b)) // the result message lasts until the next page
    if (!ocr || page < 1) {
      setState(null)
      return
    }
    setRecognisedPages(ocr.recognisedCount())
    let current = true
    void ocr.pageState(page).then((s) => current && setState(s))
    return () => {
      current = false
    }
  }, [adapterRef, page, progress?.total])

  // Closing the book stops a run that is still going.
  useEffect(() => () => queueRef.current?.cancel(), [])

  /** Reads one page and saves it at once. */
  const readAndSave = useCallback(
    async (n: number) => {
      const ocr = adapterRef.current?.ocr
      if (!ocr) return
      const lines = await ocr.recognise(n)
      await window.api.ocr.putPage(bookId, n, lines)
      setRecognisedPages(ocr.recognisedCount())
      if (pageRef.current === n) setState(lines.length > 0 ? 'recognised' : 'blank')
    },
    [adapterRef, bookId]
  )

  const recognise = useCallback(() => {
    const n = pageRef.current
    if (!adapterRef.current?.ocr || n < 1 || busyPage !== null || book.phase === 'running') return
    setBusyPage(n)
    setError(null)
    readAndSave(n)
      .catch(() => {
        if (pageRef.current === n) setError("Text recognition isn't available right now.")
      })
      .finally(() => setBusyPage(null))
  }, [adapterRef, busyPage, book.phase, readAndSave])

  const recogniseBook = useCallback(() => {
    const ocr = adapterRef.current?.ocr
    if (!ocr || busyPage !== null || queueRef.current) return
    void (async () => {
      const pictures = await ocr.picturePages() // pages already read or found blank are not read again
      const queue = new OcrQueue(
        readingOrder(pictures, pageRef.current),
        readAndSave,
        workerCount(navigator.hardwareConcurrency),
        (p) => setBook({ phase: 'running', done: p.done, total: p.total, failed: p.failed, cancelled: false })
      )
      queueRef.current = queue
      const result = await queue.start()
      queueRef.current = null
      setBook({ phase: 'finished', done: result.done, total: result.total, failed: result.failed, cancelled: result.cancelled })
    })()
  }, [adapterRef, busyPage, readAndSave])

  const cancelBook = useCallback(() => queueRef.current?.cancel(), [])

  return { state, busyPage, error, page, recognisedPages, book, recognise, recogniseBook, cancelBook }
}
