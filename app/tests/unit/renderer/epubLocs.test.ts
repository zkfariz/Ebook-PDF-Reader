import { describe, expect, it } from 'vitest'
import { cfiStart, compareCfi, rangeContains } from '../../../src/renderer/reader/epub/locs'

// A visible screen inside the 2nd spine item: from paragraph 4 offset 0 to paragraph 8 offset 10.
const screen = 'epubcfi(/6/4!/4,/8/1:0,/16/1:10)'

describe('EPUB CFI helpers', () => {
  it('cfiStart gives the start point of a range', () => {
    expect(cfiStart(screen)).toBe('epubcfi(/6/4!/4/8/1:0)')
  })

  it('rangeContains: start inclusive, end exclusive', () => {
    expect(rangeContains(screen, 'epubcfi(/6/4!/4/8/1:0)')).toBe(true) // the screen's own start
    expect(rangeContains(screen, 'epubcfi(/6/4!/4/12/1:5)')).toBe(true) // inside
    expect(rangeContains(screen, 'epubcfi(/6/4!/4/16/1:10)')).toBe(false) // the end = next screen
    expect(rangeContains(screen, 'epubcfi(/6/4!/4/6/1:0)')).toBe(false) // before
    expect(rangeContains(screen, 'epubcfi(/6/6!/4/2/1:0)')).toBe(false) // next chapter
  })

  it('rangeContains is false for garbage instead of throwing', () => {
    expect(rangeContains(screen, 'not a cfi')).toBe(false)
  })

  it('compareCfi orders by position in the book', () => {
    const list = ['epubcfi(/6/6!/4/2/1:0)', 'epubcfi(/6/4!/4/12/1:5)', 'epubcfi(/6/4!/4/8/1:0)']
    expect([...list].sort(compareCfi)).toEqual([
      'epubcfi(/6/4!/4/8/1:0)',
      'epubcfi(/6/4!/4/12/1:5)',
      'epubcfi(/6/6!/4/2/1:0)'
    ])
  })
})
