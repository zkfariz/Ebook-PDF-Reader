import * as pdfjs from 'pdfjs-dist'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

interface CachedPage {
  key: string // scale + device pixel ratio the canvas was drawn at
  canvas: HTMLCanvasElement
}

/**
 * Draws PDF pages to canvases and keeps the current page ±1 ready (S2): page turns are instant,
 * memory stays flat (other pages are dropped and their pdf.js resources freed).
 */
export class PageCanvases {
  private currentTask?: RenderTask
  private backgroundTasks = new Set<RenderTask>()
  private cache = new Map<number, CachedPage>()

  /**
   * Canvas for page `n` at `scale` (CSS pixels per PDF unit), from cache or freshly drawn at
   * device-pixel resolution so text stays sharp. Null if the drawing was cancelled.
   */
  async draw(page: PDFPageProxy, n: number, scale: number, isCurrent: boolean): Promise<HTMLCanvasElement | null> {
    const dpr = window.devicePixelRatio || 1
    const key = `${scale.toFixed(5)}@${dpr}`
    const cached = this.cache.get(n)
    if (cached?.key === key) return cached.canvas

    const viewport = page.getViewport({ scale: scale * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`

    const task = page.render({ canvas, viewport })
    if (isCurrent) this.currentTask = task
    else this.backgroundTasks.add(task)
    try {
      await task.promise
    } catch (err) {
      if (err instanceof pdfjs.RenderingCancelledException) return null
      throw err
    } finally {
      this.backgroundTasks.delete(task)
    }
    this.cache.set(n, { key, canvas })
    return canvas
  }

  /** Forgets every page except `center` ±1 and asks pdf.js to free their resources. */
  keepAround(center: number, release: (n: number) => void): void {
    for (const n of this.cache.keys()) {
      if (Math.abs(n - center) <= 1) continue
      this.cache.delete(n)
      release(n)
    }
  }

  cancelCurrent(): void {
    this.currentTask?.cancel()
  }

  cancelAll(): void {
    this.currentTask?.cancel()
    this.backgroundTasks.forEach((t) => t.cancel())
    this.backgroundTasks.clear()
    this.cache.clear()
  }
}
