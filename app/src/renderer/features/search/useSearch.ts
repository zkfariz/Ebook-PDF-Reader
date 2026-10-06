import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ReaderAdapter, SearchHit } from '../../reader/ReaderAdapter'
import { prepareQuery } from '../../reader/pdf/pageText'

export const RESULT_CAP = 500 // spec F09: "results capped at 500"

export type SearchStatus = 'idle' | 'searching' | 'done'

/**
 * Search state for the open book (F09): runs the adapter's streaming search, keeps the
 * results, the active one, and the "why nothing was found" information.
 */
export function useSearch(adapterRef: RefObject<ReaderAdapter | null>) {
  const [ranQuery, setRanQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [capped, setCapped] = useState(false)
  const [noText, setNoText] = useState(false)
  const [active, setActive] = useState(-1)
  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setRanQuery('')
    setResults([])
    setStatus('idle')
    setCapped(false)
    setNoText(false)
    setActive(-1)
    adapterRef.current?.showSearchMatch(null)
  }, [adapterRef])

  // Stop a running search when the book is closed.
  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(
    async (query: string) => {
      const adapter = adapterRef.current
      clear()
      if (!adapter || !prepareQuery(query)) return
      const controller = new AbortController()
      abortRef.current = controller
      setRanQuery(query)
      setStatus('searching')
      let count = 0
      for await (const batch of adapter.search(query, controller.signal)) {
        if (controller.signal.aborted) return
        const room = RESULT_CAP - count
        const take = batch.slice(0, room)
        count += take.length
        setResults((prev) => [...prev, ...take])
        if (count >= RESULT_CAP) {
          setCapped(true)
          controller.abort() // enough: stop reading the rest of the book
          break
        }
      }
      if (abortRef.current !== controller) return // a newer search replaced this one
      if (count === 0) setNoText(!(await adapter.hasText()))
      setStatus('done')
    },
    [adapterRef, clear]
  )

  const select = useCallback(
    async (index: number) => {
      const hit = results[index]
      const adapter = adapterRef.current
      if (!hit || !adapter) return
      setActive(index)
      await adapter.goTo(hit.loc)
      adapter.showSearchMatch(hit) // F09.2: static outline on the match
    },
    [results, adapterRef]
  )

  /** Enter / Shift+Enter: next / previous result (wraps around). */
  const step = useCallback(
    (dir: 1 | -1) => {
      if (results.length === 0) return
      const next = active < 0 ? (dir === 1 ? 0 : results.length - 1) : (active + dir + results.length) % results.length
      void select(next)
    },
    [results.length, active, select]
  )

  return { ranQuery, results, status, capped, noText, active, run, clear, select, step }
}
