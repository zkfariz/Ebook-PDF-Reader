import { describe, expect, it } from 'vitest'
import { OcrQueue, readingOrder, workerCount } from '../../src/renderer/reader/ocr/OcrQueue'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('OcrQueue', () => {
  it('reads every page, in order, and reports progress', async () => {
    const seen: number[] = []
    const progress: number[] = []
    const q = new OcrQueue([3, 4, 5], async (p) => void seen.push(p), 1, (p) => progress.push(p.done))
    const result = await q.start()
    expect(seen).toEqual([3, 4, 5])
    expect(progress).toEqual([0, 1, 2, 3])
    expect(result).toEqual({ total: 3, done: 3, failed: 0, cancelled: false })
  })

  it('never reads more pages at once than the limit', async () => {
    let running = 0
    let peak = 0
    const q = new OcrQueue([1, 2, 3, 4, 5, 6, 7], async () => {
      peak = Math.max(peak, ++running)
      await tick()
      running--
    }, 3)
    await q.start()
    expect(peak).toBe(3)
  })

  it('cancel stops starting new pages; pages already running finish', async () => {
    const started: number[] = []
    const finished: number[] = []
    let q!: OcrQueue
    q = new OcrQueue([1, 2, 3, 4, 5, 6], async (p) => {
      started.push(p)
      if (p === 2) q.cancel() // the user pressed Cancel while page 2 was being read
      await tick()
      finished.push(p)
    }, 2)
    const result = await q.start()
    expect(result.cancelled).toBe(true)
    expect(started).toEqual(finished) // nothing was left half-done
    expect(started.length).toBeLessThan(6)
    expect(result.done).toBe(finished.length)
  })

  it('a failing page is counted and the rest carry on', async () => {
    const q = new OcrQueue([1, 2, 3], async (p) => {
      if (p === 2) throw new Error('boom')
    }, 1)
    expect(await q.start()).toEqual({ total: 3, done: 3, failed: 1, cancelled: false })
  })

  it('an empty list finishes at once', async () => {
    expect(await new OcrQueue([], async () => undefined, 3).start()).toEqual({ total: 0, done: 0, failed: 0, cancelled: false })
  })
})

describe('readingOrder', () => {
  it('goes from the page on screen to the end, then the earlier pages', () => {
    expect(readingOrder([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5, 1, 2])
    expect(readingOrder([2, 4, 6], 1)).toEqual([2, 4, 6])
    expect(readingOrder([2, 4, 6], 9)).toEqual([2, 4, 6])
  })
})

describe('workerCount', () => {
  it('leaves a core for the reader and never exceeds 3', () => {
    expect(workerCount(16)).toBe(3)
    expect(workerCount(4)).toBe(3)
    expect(workerCount(3)).toBe(2)
    expect(workerCount(2)).toBe(1)
    expect(workerCount(1)).toBe(1)
    expect(workerCount(undefined)).toBe(3)
  })
})
