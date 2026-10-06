import type { PDFPageProxy } from 'pdfjs-dist'

/** Long side of the bitmap that is recognised: about 200 to 250 dpi on a book page. Tesseract is accurate here. */
export const OCR_LONG_SIDE = 2200

/** Renders one PDF page to a bitmap for the OCR engine (not shown to the user). */
export async function renderPageForOcr(page: PDFPageProxy) {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: OCR_LONG_SIDE / Math.max(base.width, base.height) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make an image of the page'))), 'image/png')
  )
  // Free the big bitmap right away.
  canvas.width = 0
  canvas.height = 0
  return { blob, viewport }
}
