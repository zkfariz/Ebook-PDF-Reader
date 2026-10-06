// Zoom maths for PDF pages (spec F03). Pure functions so they can be unit-tested.

/** Allowed zoom levels, as factors (1 = 100 %). */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 3, 4]

/** PDF units are 1/72 inch, CSS pixels 1/96 inch: 100 % shows the page at its real size. */
export const PDF_TO_CSS = 96 / 72

export function nextZoomStep(current: number, direction: 1 | -1): number {
  const eps = 0.001
  if (direction === 1) return ZOOM_STEPS.find((z) => z > current + eps) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!
  return [...ZOOM_STEPS].reverse().find((z) => z < current - eps) ?? ZOOM_STEPS[0]!
}

/**
 * Scale factor for pdf.js getViewport() for a page of size (pageW × pageH) in PDF units,
 * shown in an area of (availW × availH) CSS pixels.
 */
export function viewportScale(
  zoom: number | 'fit-width' | 'fit-page',
  pageW: number,
  pageH: number,
  availW: number,
  availH: number
): number {
  if (zoom === 'fit-width') return Math.max(0.1, availW / pageW)
  if (zoom === 'fit-page') return Math.max(0.1, Math.min(availW / pageW, availH / pageH))
  return zoom * PDF_TO_CSS
}

/** Effective zoom percent for a viewport scale (used for fit modes in the toolbar). */
export function scaleToPercent(scale: number): number {
  return Math.round((scale / PDF_TO_CSS) * 100)
}
