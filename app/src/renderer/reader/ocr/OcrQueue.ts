/** Progress of a whole-book run (F16.3). */
export interface QueueProgress {
  total: number
  /** Pages finished, successfully or not. */
  done: number
  /** Pages that could not be read. */
  failed: number
}

export interface QueueResult extends QueueProgress {
  cancelled: boolean
}

/**
 * Runs `run(page)` for every page, a few at a time, in the given order (F16.3).
 * - `cancel()` stops starting new pages. Pages already being read finish, and `start()` resolves then.
 * - A page that throws is counted as failed; the rest carry on.
 * Pure scheduling: it knows nothing about OCR, so it is tested with a fake `run`.
 */
export class OcrQueue {
  private cancelled = false

  constructor(
    private readonly pages: readonly number[],
    private readonly run: (page: number) => Promise<void>,
    private readonly concurrency: number,
    private readonly onProgress: (p: QueueProgress) => void = () => undefined
  ) {}

  cancel(): void {
    this.cancelled = true
  }

  async start(): Promise<QueueResult> {
    const progress: QueueProgress = { total: this.pages.length, done: 0, failed: 0 }
    let next = 0
    this.onProgress({ ...progress })
    const worker = async () => {
      while (!this.cancelled && next < this.pages.length) {
        const page = this.pages[next++]!
        try {
          await this.run(page)
        } catch {
          progress.failed++
        }
        progress.done++
        this.onProgress({ ...progress })
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(this.concurrency, this.pages.length)) }, worker))
    return { ...progress, cancelled: this.cancelled }
  }
}

/** Pages in the order they are read: from the page on screen to the end, then the earlier ones (F16.3). */
export function readingOrder(pages: readonly number[], current: number): number[] {
  return [...pages.filter((p) => p >= current), ...pages.filter((p) => p < current)]
}

/** How many engines to run at once: leaves a core for the reader itself, at most 3 (about 150 MB each). */
export function workerCount(cores: number | undefined): number {
  return Math.max(1, Math.min(3, (cores ?? 4) - 1))
}
