import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './helpers'

/**
 * Makes a temporary image-only PDF of `pages` pages that all show the first page of scanned.pdf
 * (one shared picture, so the file stays small). Lets tests read a "long" scanned book without a big fixture.
 */
export function makeScannedCopy(pages: number, name = `scanned-${pages}p.pdf`): { path: string; bookId: string } {
  const source = readFileSync(fixture('scanned.pdf'))
  const header = /\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/.exec(
    source.toString('latin1')
  )
  if (!header) throw new Error('scanned.pdf has no JPEG page image')
  const [, width, height, length] = header
  const start = header.index + header[0].length
  const jpeg = source.subarray(start, start + Number(length))

  const chunks: Buffer[] = []
  let size = 0
  const offsets: number[] = []
  const put = (data: Buffer | string) => {
    const b = Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1')
    chunks.push(b)
    size += b.length
  }
  const object = (n: number, body: string, stream?: Buffer | string) => {
    offsets[n] = size
    put(`${n} 0 obj\n${body}\n`)
    if (stream) {
      put('stream\n')
      put(stream)
      put('\nendstream\n')
    }
    put('endobj\n')
  }
  const content = 'q 612 0 0 792 0 0 cm /Im0 Do Q'
  put('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`)
  object(
    3,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg
  )
  for (let i = 0; i < pages; i++) {
    object(4 + i * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`)
    object(5 + i * 2, `<< /Length ${content.length} >>`, content)
  }
  const total = 4 + pages * 2
  const xref = size
  put(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let n = 1; n < total; n++) put(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const path = join(mkdtempSync(join(tmpdir(), 'ebook-scan-')), name)
  const pdf = Buffer.concat(chunks)
  writeFileSync(path, pdf)
  return { path, bookId: createHash('sha256').update(pdf).digest('hex') }
}
