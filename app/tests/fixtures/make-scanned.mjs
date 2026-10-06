// Generates scanned.pdf: a 3-page PDF made only of pictures (no text layer), like a scanned book (F16).
//   node tests/fixtures/make-scanned.mjs
// Pages 1 and 2 are text drawn on an off-white, slightly noisy "paper" and saved as JPEG; page 3 is blank
// (tests "No text found on this page"). The text is public domain (Conan Doyle, 1892).
// Needs Electron (to draw the pages), so it is separate from make-fixtures.mjs, which has no dependencies.
import { _electron as electron } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const page1 = [
  'My experience of camp life in Afghanistan had at least had the effect of making me a prompt and ready traveller. My wants were few and simple, so that in less than the time stated I was in a cab with my valise, rattling away to Paddington Station. Sherlock Holmes was pacing up and down the platform, his tall, gaunt figure made even gaunter and taller by his long grey travelling-cloak and close-fitting cloth cap.',
  'We had the carriage to ourselves save for an immense litter of papers which Holmes had brought with him. Among these he rummaged and read, with intervals of note-taking and of meditation, until we were past Reading. Then he suddenly rolled them all into a gigantic ball and tossed them up onto the rack.',
  'He picked out from his bundle a copy of the local Herefordshire paper, and having turned down the sheet he pointed out the paragraph in which the unfortunate young man had given his own statement of what had occurred. I settled myself down in the corner of the carriage and read it very carefully. It ran in this way:'
]
const page2 = [
  'He had hardly spoken before there rushed into the room one of the most lovely young women that I have ever seen in my life. Her violet eyes shining, her lips parted, a pink flush upon her cheeks, all thought of her natural reserve lost in her overpowering excitement and concern.',
  'Sherlock Holmes was transformed when he was hot upon such a scent as this. Men who had only known the quiet thinker and logician of Baker Street would have failed to recognise him. His face flushed and darkened. His brows were drawn into two hard black lines, while his eyes shone out from beneath them with a steely glitter. Swiftly and silently he made his way along the track which ran through the meadows, and so by way of the woods to the Boscombe Pool. It was damp, marshy ground, as is all that district, and there were marks of many feet, both upon the path and amid the short grass which bounded it on either side.',
  'It was about ten minutes before we regained our cab and drove back into Ross, Holmes still carrying with him the stone which he had picked up in the wood.'
]

const W = 1275 // 8.5 x 11 inch at 150 dpi
const H = 1650
const app = await electron.launch({ args: [join(here, 'scanned-main.cjs')] })
const win = await app.firstWindow()
const jpegs = await win.evaluate(
  async ({ pages, W, H }) => {
    const draw = (paras) => {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const g = c.getContext('2d')
      g.fillStyle = '#f3efe3'
      g.fillRect(0, 0, W, H)
      g.fillStyle = '#1c1c1c'
      g.font = '27px Georgia, serif'
      let y = 150
      for (const p of paras) {
        let line = ''
        for (const word of p.split(' ')) {
          if (g.measureText(line + ' ' + word).width > W - 260) {
            g.fillText(line.trim(), 130, y)
            y += 40
            line = ''
          }
          line += ' ' + word
        }
        g.fillText(line.trim(), 130, y)
        y += 70
      }
      const d = g.getImageData(0, 0, W, H) // paper grain, like a real scan
      for (let i = 0; i < d.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 24
        d.data[i] += n
        d.data[i + 1] += n
        d.data[i + 2] += n
      }
      g.putImageData(d, 0, 0)
      return c.toDataURL('image/jpeg', 0.55)
    }
    return pages.map(draw)
  },
  { pages: [page1, page2, []], W, H }
)
await app.close()

// ---- a minimal PDF: one full-page JPEG per page, no text ----
const chunks = []
let size = 0
const offsets = []
const put = (data) => {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1')
  chunks.push(b)
  size += b.length
}
const object = (n, body, stream) => {
  offsets[n] = size
  put(`${n} 0 obj\n${body}\n`)
  if (stream) {
    put('stream\n')
    put(stream)
    put('\nendstream\n')
  }
  put('endobj\n')
}
put('%PDF-1.4\n')
const pageCount = jpegs.length
object(1, '<< /Type /Catalog /Pages 2 0 R >>')
object(2, `<< /Type /Pages /Kids [${jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pageCount} >>`)
jpegs.forEach((url, i) => {
  const jpeg = Buffer.from(url.split(',')[1], 'base64')
  const pageObj = 3 + i * 3
  const contentObj = pageObj + 1
  const imageObj = pageObj + 2
  object(
    pageObj,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`
  )
  const content = 'q 612 0 0 792 0 0 cm /Im0 Do Q'
  object(contentObj, `<< /Length ${content.length} >>`, content)
  object(imageObj, `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg)
})
const total = 3 + pageCount * 3
const xref = size
put(`xref\n0 ${total}\n0000000000 65535 f \n`)
for (let n = 1; n < total; n++) put(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
writeFileSync(join(here, 'scanned.pdf'), Buffer.concat(chunks))
console.log('scanned.pdf written:', Math.round(size / 1024), 'KB,', pageCount, 'pages')
process.exit(0)
