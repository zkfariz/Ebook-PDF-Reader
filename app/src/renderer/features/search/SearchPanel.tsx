import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MIN_QUERY_LENGTH } from '../../reader/pdf/pageText'
import { RESULT_CAP, type useSearch } from './useSearch'
import './search.css'

interface SearchPanelProps {
  search: ReturnType<typeof useSearch>
  /** Changes whenever Ctrl+F / 🔍 asks for the search box to get the keyboard. */
  focusToken: number
}

/** F09: search box + result list with the match in bold and where it is. */
export function SearchPanel({ search, focusToken }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [text, setText] = useState(search.ranQuery)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusToken])

  // Keep the active result visible while stepping with Enter.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [search.active])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Same words as the last search → move through the results; otherwise search again.
    if (text === search.ranQuery && search.results.length > 0) search.step(e.shiftKey ? -1 : 1)
    else void search.run(text)
  }

  const { status, results, capped, noText, ranQuery } = search
  const tooShort = text.trim().length > 0 && text.trim().length < MIN_QUERY_LENGTH

  return (
    <div className="search-panel">
      <input
        ref={inputRef}
        type="search"
        className="search-box"
        aria-label="Search in book"
        placeholder="Search in book…"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value === '') search.clear() // F09.5: clearing the box cancels
        }}
        onKeyDown={onKeyDown}
      />

      <p className="search-status" role="status">
        {tooShort && `Type at least ${MIN_QUERY_LENGTH} characters.`}
        {!tooShort && status === 'searching' && `Searching… ${results.length || ''}`}
        {!tooShort && status === 'done' && results.length > 0 && (
          <>
            {results.length} {results.length === 1 ? 'result' : 'results'}
            {capped && ` · Showing first ${RESULT_CAP} results`}
          </>
        )}
        {!tooShort && status === 'done' && results.length === 0 && noText &&
          (search.canRecognise
          ? 'This book has no searchable text. Recognise it to search.'
          : 'This book has no searchable text (it may be scanned).')}
        {!tooShort && status === 'done' && results.length === 0 && !noText && `No results for '${ranQuery}'`}
      </p>

      {results.length > 0 && (
        <ol className="search-results" aria-label="Search results" ref={listRef}>
          {results.map((hit, i) => (
            <li key={hit.id}>
              <button
                className="search-result"
                aria-current={i === search.active ? 'true' : undefined}
                onClick={() => void search.select(i)}
              >
                <span className="search-where">{hit.label}</span>
                <span className="search-snippet">
                  {hit.pre}
                  <strong>{hit.match}</strong>
                  {hit.post}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
