import { createWorker, OEM, type Worker } from 'tesseract.js'
import type { PixelLine } from './ocrGeometry'

// Everything the engine needs is bundled with the app (scripts/copy-ocr-assets.mjs). All three paths are
// set on purpose: left at their defaults, tesseract.js would download from a CDN, which the offline
// rule forbids (and the request blocker would cancel).
const asset = (path: string) => new URL(`ocr/${path}`, document.baseURI).href

/** One English text recogniser (a tesseract.js worker thread). It starts on first use. */
export class OcrEngine {
  private worker?: Promise<Worker>

  private start(): Promise<Worker> {
    this.worker ??= createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: asset('worker.min.js'),
      corePath: asset('core/tesseract-core-simd-lstm.wasm.js'),
      langPath: asset('lang'),
      gzip: true,
      workerBlobURL: false,
      cacheMethod: 'none'
    }).catch((err: unknown) => {
      this.worker = undefined // allow a later retry
      throw err
    })
    return this.worker
  }

  /** Reads the text lines of a page bitmap, in reading order. Boxes are in bitmap pixels. */
  async recognise(image: Blob): Promise<PixelLine[]> {
    const worker = await this.start()
    const { data } = await worker.recognize(image, {}, { blocks: true })
    return (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.map((line) => ({ text: line.text, bbox: line.bbox }))
      )
    )
  }

  /** Stops the worker thread and frees its memory (each holds about 100–200 MB). */
  async dispose(): Promise<void> {
    const pending = this.worker
    this.worker = undefined
    if (pending) await (await pending.catch(() => undefined))?.terminate()
  }
}
