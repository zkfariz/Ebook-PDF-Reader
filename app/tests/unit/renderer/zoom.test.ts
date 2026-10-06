import { describe, expect, it } from 'vitest'
import { nextZoomStep, PDF_TO_CSS, scaleToPercent, viewportScale } from '../../../src/renderer/reader/pdf/zoom'

describe('zoom steps', () => {
  it('steps up and down through the list', () => {
    expect(nextZoomStep(1, 1)).toBe(1.1)
    expect(nextZoomStep(1, -1)).toBe(0.9)
    expect(nextZoomStep(0.5, -1)).toBe(0.5) // clamps at the ends
    expect(nextZoomStep(4, 1)).toBe(4)
  })

  it('from an in-between fit percentage goes to the nearest step in that direction', () => {
    expect(nextZoomStep(0.83, 1)).toBe(0.9)
    expect(nextZoomStep(0.83, -1)).toBe(0.75)
  })
})

describe('viewportScale', () => {
  const A4 = { w: 595, h: 842 }
  it('fit-page fits both dimensions', () => {
    const s = viewportScale('fit-page', A4.w, A4.h, 1000, 600)
    expect(A4.h * s).toBeCloseTo(600)
    expect(A4.w * s).toBeLessThanOrEqual(1000)
  })
  it('fit-width fits the width only', () => {
    expect(A4.w * viewportScale('fit-width', A4.w, A4.h, 1000, 600)).toBeCloseTo(1000)
  })
  it('a number is a real-size percentage', () => {
    expect(viewportScale(1, A4.w, A4.h, 10, 10)).toBeCloseTo(PDF_TO_CSS)
    expect(scaleToPercent(viewportScale(1.25, A4.w, A4.h, 10, 10))).toBe(125)
  })
})
