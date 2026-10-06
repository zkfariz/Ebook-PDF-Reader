// Copies pdf.js runtime assets (standard fonts, CMaps, ICC profiles, wasm decoders) into the
// renderer's public folder, so they are served locally and packaged with the app (offline rule).
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const dest = join(root, 'src', 'renderer', 'public', 'pdfjs')

rmSync(dest, { recursive: true, force: true })
for (const dir of ['standard_fonts', 'cmaps', 'iccs', 'wasm']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true })
}
console.log('pdf.js assets copied to', dest)
