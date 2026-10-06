import type { OcrView } from './useOcr'

/**
 * Slim notice at the bottom of the page for PDFs that are only pictures (F16.1). It floats over the
 * page margin, so showing or hiding it never changes the size of the page.
 */
export function OcrNotice({ ocr }: { ocr: OcrView }) {
  const { state, busyPage, error, page, recognise } = ocr
  const busy = busyPage === page

  let body: React.ReactNode = null
  if (busy) body = <span>Reading this page…</span>
  else if (state === 'picture')
    body = (
      <>
        <span>This page is a picture, so its text can't be selected or searched.</span>
        <button className="primary" onClick={recognise} disabled={busyPage !== null}>
          Recognise text
        </button>
        {error && <span className="ocr-error">{error}</span>}
      </>
    )
  else if (state === 'recognised') body = <span>Recognised text may contain mistakes.</span>
  else if (state === 'blank')
    body = <span>No text found on this page.</span>
  if (!body) return null

  return (
    <div className="ocr-notice" role="status" data-state={busy ? 'busy' : state}>
      {body}
    </div>
  )
}
