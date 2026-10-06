// Copies the OCR engine (F16) into the renderer's public folder, so it is served from app://bundle/ocr/
// and packaged with the app: tesseract.js must never download anything (offline rule).
//   ocr/worker.min.js                          the tesseract.js worker
//   ocr/core/tesseract-core-simd-lstm.wasm.js  the engine (WebAssembly embedded), LSTM only
//   ocr/lang/eng.traineddata.gz                English data, "best_int" (about 3 MB)
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const modules = join(root, 'node_modules')
const dest = join(root, 'src', 'renderer', 'public', 'ocr')

rmSync(dest, { recursive: true, force: true })
for (const sub of ['core', 'lang']) mkdirSync(join(dest, sub), { recursive: true })
copyFileSync(join(modules, 'tesseract.js', 'dist', 'worker.min.js'), join(dest, 'worker.min.js'))
copyFileSync(
  join(modules, 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'),
  join(dest, 'core', 'tesseract-core-simd-lstm.wasm.js')
)
copyFileSync(
  join(modules, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
  join(dest, 'lang', 'eng.traineddata.gz')
)
console.log('OCR assets copied to', dest)
