import type { OcrView } from './useOcr'

/**
 * Slim notice at the bottom of the page for PDFs that are only pictures (F16.1) and for a
 * whole-book run (F16.3). It floats over the page margin, so showing or hiding it never
 * changes the size of the page.
 */
export function OcrNotice({ ocr }: { ocr: OcrView }) {
  const { state, busyPage, error, page, recognisedPages, book, recognise, recogniseBook, cancelBook } = ocr
  const busy = busyPage === page

  let body: React.ReactNode = null
  let dataState: string | null = state
  if (book.phase === 'running') {
    dataState = 'book-running'
    body = (
      <>
        <span>
          Recognising the book: {book.done} of {book.total} pages. You can keep reading.
        </span>
        <button onClick={cancelBook}>Cancel</button>
      </>
    )
  } else if (book.phase === 'finished') {
    dataState = 'book-finished'
    const pages = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`
    body = (
      <>
        <span>
          {book.total === 0
            ? 'No pages are left to recognise.'
            : book.cancelled
              ? `Stopped. ${book.done} of ${book.total} pages were read.`
              : book.failed > 0
                ? `Finished. ${pages(book.failed)} could not be read.`
                : `Finished. ${pages(book.total)} read.`}
        </span>
        {(book.cancelled || book.failed > 0) && (
          <button onClick={recogniseBook}>{book.cancelled ? 'Continue' : 'Try again'}</button>
        )}
      </>
    )
  } else if (busy) {
    dataState = 'busy'
    body = <span>Reading this page…</span>
  } else if (state === 'picture') {
    body = (
      <>
        <span>This page is a picture, so its text can't be selected or searched.</span>
        <button className="primary" onClick={recognise} disabled={busyPage !== null}>
          Recognise text
        </button>
        <button onClick={recogniseBook} disabled={busyPage !== null}>
          {recognisedPages > 0 ? 'Continue recognising the book' : 'Recognise the whole book'}
        </button>
        {error && <span className="ocr-error">{error}</span>}
      </>
    )
  } else if (state === 'recognised') body = <span>Recognised text may contain mistakes.</span>
  else if (state === 'blank') body = <span>No text found on this page.</span>
  if (!body) return null

  return (
    <div className="ocr-notice" role="status" data-state={dataState ?? undefined}>
      {body}
    </div>
  )
}
