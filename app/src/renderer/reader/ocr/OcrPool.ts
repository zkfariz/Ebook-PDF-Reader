import type { OcrEngine } from './OcrEngine'

const IDLE_MS = 20_000 // a worker thread holds about 150 MB: let go of them soon after the work is done
export const MAX_ENGINES = 3

/**
 * Up to MAX_ENGINES recognisers, started as needed and all stopped a while after the last job (F16 memory rule).
 * The OCR code itself is loaded on first use, so books that never need it do not pay for it.
 */
export class OcrPool {
  private idle: OcrEngine[] = []
  private all = new Set<OcrEngine>()
  private waiting: ((engine: OcrEngine) => void)[] = []
  private timer?: ReturnType<typeof setTimeout>
  private closed = false

  /** Runs `job` with a free engine, waiting if all MAX_ENGINES are busy. */
  async run<T>(job: (engine: OcrEngine) => Promise<T>): Promise<T> {
    const engine = await this.take()
    try {
      return await job(engine)
    } finally {
      this.give(engine)
    }
  }

  /** Stops every engine now (the book was closed). */
  async dispose(): Promise<void> {
    this.closed = true
    clearTimeout(this.timer)
    const engines = [...this.all]
    this.all.clear()
    this.idle = []
    await Promise.all(engines.map((e) => e.dispose()))
  }

  private async take(): Promise<OcrEngine> {
    clearTimeout(this.timer)
    const free = this.idle.pop()
    if (free) return free
    if (this.all.size < MAX_ENGINES) {
      const { OcrEngine } = await import('./OcrEngine')
      const engine = new OcrEngine()
      this.all.add(engine)
      return engine
    }
    return new Promise((resolve) => this.waiting.push(resolve))
  }

  private give(engine: OcrEngine): void {
    const next = this.waiting.shift()
    if (next) return next(engine)
    this.idle.push(engine)
    if (this.idle.length === this.all.size && !this.closed) {
      this.timer = setTimeout(() => void this.releaseIdle(), IDLE_MS)
    }
  }

  private async releaseIdle(): Promise<void> {
    const engines = this.idle
    this.idle = []
    for (const e of engines) this.all.delete(e)
    await Promise.all(engines.map((e) => e.dispose()))
  }
}
