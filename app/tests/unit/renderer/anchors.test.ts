import { describe, expect, it } from 'vitest'
import { resolvePdfOffsets } from '../../../src/renderer/reader/pdf/anchors'

const page = 'The quick brown fox jumps over the lazy dog.\nCrème brûlée is a dessert.'

describe('resolvePdfOffsets (highlight robustness, data-model §3)', () => {
  it('keeps offsets that still match', () => {
    expect(resolvePdfOffsets(page, 4, 9, 'quick')).toEqual({ start: 4, end: 9 })
  })

  it('finds the text again if the offsets moved', () => {
    const moved = 'Extra words at the start. ' + page
    const at = resolvePdfOffsets(moved, 4, 9, 'quick')!
    expect(moved.slice(at.start, at.end)).toBe('quick')
  })

  it('falls back to a case/accent-insensitive match', () => {
    const changed = page.replace('Crème brûlée', 'Creme brulee')
    const at = resolvePdfOffsets(changed, 45, 57, 'Crème brûlée')!
    expect(changed.slice(at.start, at.end)).toBe('Creme brulee')
  })

  it('returns null when the text is gone', () => {
    expect(resolvePdfOffsets('Something else entirely', 0, 5, 'quick brown')).toBeNull()
  })
})
