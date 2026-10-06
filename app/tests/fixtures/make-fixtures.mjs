// Generates small, copyright-free test files for unit/e2e tests (no dependencies).
//   node tests/fixtures/make-fixtures.mjs
// Outputs: sample-3p.pdf · large-500p.pdf · no-text.pdf · toc.pdf (nested outline + named dest) · protected.pdf (password "test") · corrupt.pdf · not-a-book.txt
//          sample.epub (3 chapters, with a planted script + remote image) · no-toc.epub · styled.epub (own colours, like Project Gutenberg) · font-obfuscated.epub · drm.epub · corrupt.epub
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// ---------- PDF Standard Security Handler, revision 2 (RC4 40-bit) ----------
const PAD = Buffer.from(
  '28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A',
  'hex'
)
const md5 = (...parts) => createHash('md5').update(Buffer.concat(parts)).digest()
const padPwd = (p) => Buffer.concat([Buffer.from(p, 'latin1'), PAD]).subarray(0, 32)

function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255
    j = (j + s[i]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255]
  }
  return out
}

function makeSecurity(userPwd, ownerPwd, id0) {
  const P = -4
  const O = rc4(md5(padPwd(ownerPwd)).subarray(0, 5), padPwd(userPwd))
  const p = Buffer.alloc(4)
  p.writeInt32LE(P)
  const key = md5(padPwd(userPwd), O, p, id0).subarray(0, 5)
  const U = rc4(key, PAD)
  const objKey = (num, gen) =>
    md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255])).subarray(0, 10)
  return { O, U, P, objKey }
}

// ---------- minimal PDF writer ----------
// Each object is a function (enc) => Buffer so strings/streams can be encrypted per object.
// outline: [{ title, page, named?, children? }] → PDF bookmarks (named = via the /Dests name tree)
function buildPdf({ title, pages, password, outline }) {
  const id0 = md5(Buffer.from(title))
  const sec = password ? makeSecurity(password, password + '-owner', id0) : null
  const crypt = (num, data) => (sec ? rc4(sec.objKey(num, 0), data) : data)
  const hexStr = (num, s) => `<${crypt(num, Buffer.from(s, 'latin1')).toString('hex')}>`

  const objs = [] // index = object number - 1
  const add = (fn) => objs.push(fn) // returns object number
  let outlineRoot = null
  let namesObj = null
  const catalog = add(
    () =>
      `<< /Type /Catalog /Pages 2 0 R` +
      (outlineRoot ? ` /Outlines ${outlineRoot} 0 R /PageMode /UseOutlines` : '') +
      (namesObj ? ` /Names ${namesObj} 0 R` : '') +
      ` >>`
  )
  add(() => `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`)
  // WinAnsiEncoding so latin1 accents (é, è, û) in the text come out right.
  const font = add(() => `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`)
  const pageRefs = []
  pages.forEach((lines) => {
    const contentNum = objs.length + 2
    const pageNum = add(
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentNum} 0 R >>`
    )
    pageRefs.push(`${pageNum} 0 R`)
    const text = lines
      .map((l, i) => `BT /F1 ${i === 0 ? 28 : 14} Tf 72 ${760 - i * 26} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`)
      .join('\n')
    add((num) => {
      const data = crypt(num, Buffer.from(text, 'latin1'))
      return Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`), data, Buffer.from('\nendstream')])
    })
  })
  const info = add((num) => `<< /Title ${hexStr(num, title)} /Author ${hexStr(num, 'Ebook Reader tests')} >>`)
  if (outline) {
    const named = []
    objs.push(null)
    outlineRoot = objs.length
    const build = (items, parent) => {
      const nums = items.map(() => (objs.push(null), objs.length))
      items.forEach((it, i) => {
        const kids = it.children ? build(it.children, nums[i]) : null
        if (it.named) named.push([it.named, it.page])
        const dest = it.named ? `(${it.named})` : `[${pageRefs[it.page - 1]} /Fit]`
        objs[nums[i] - 1] = () =>
          `<< /Title (${it.title}) /Parent ${parent} 0 R` +
          (i > 0 ? ` /Prev ${nums[i - 1]} 0 R` : '') +
          (i < items.length - 1 ? ` /Next ${nums[i + 1]} 0 R` : '') +
          (kids ? ` /First ${kids[0]} 0 R /Last ${kids[kids.length - 1]} 0 R /Count ${kids.length}` : '') +
          ` /Dest ${dest} >>`
      })
      return nums
    }
    const top = build(outline, outlineRoot)
    objs[outlineRoot - 1] = () => `<< /Type /Outlines /First ${top[0]} 0 R /Last ${top[top.length - 1]} 0 R /Count ${top.length} >>`
    if (named.length) {
      const sorted = named.sort(([a], [b]) => a.localeCompare(b))
      namesObj = add(() => `<< /Dests << /Names [${sorted.map(([n, p]) => `(${n}) [${pageRefs[p - 1]} /Fit]`).join(' ')}] >> >>`)
    }
  }
  const encrypt = sec
    ? add(() => `<< /Filter /Standard /V 1 /R 2 /O <${sec.O.toString('hex')}> /U <${sec.U.toString('hex')}> /P ${sec.P} >>`)
    : null

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  const offsets = []
  let pos = chunks[0].length
  objs.forEach((fn, i) => {
    const num = i + 1
    const body = fn(num)
    const buf = Buffer.concat([Buffer.from(`${num} 0 obj\n`), Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'), Buffer.from('\nendobj\n')])
    offsets.push(pos)
    chunks.push(buf)
    pos += buf.length
  })
  const xref =
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R` +
    (encrypt ? ` /Encrypt ${encrypt} 0 R` : '') +
    ` /ID [<${id0.toString('hex')}> <${id0.toString('hex')}>] >>\nstartxref\n${pos}\n%%EOF\n`
  chunks.push(Buffer.from(xref, 'latin1'))
  return Buffer.concat(chunks)
}

const pages = [1, 2, 3].map((n) => [
  `Sample page ${n}`,
  'The quick brown fox jumps over the lazy dog.',
  `This is test text on page ${n} for search and highlights.`,
  ...(n === 2 ? ['Accents: a CAFÉ with crème brûlée.'] : [])
])

writeFileSync(join(here, 'sample-3p.pdf'), buildPdf({ title: 'Sample Three Pages', pages }))
writeFileSync(join(here, 'protected.pdf'), buildPdf({ title: 'Protected Sample', pages: pages.slice(0, 1), password: 'test' }))
const manyPages = Array.from({ length: 500 }, (_, i) => [
  `Long book page ${i + 1}`,
  ...Array.from({ length: 24 }, (_, l) => `Line ${l + 1} of page ${i + 1}: the quick brown fox jumps over the lazy dog.`)
])
writeFileSync(join(here, 'large-500p.pdf'), buildPdf({ title: 'Large Five Hundred Pages', pages: manyPages }))
const tocPages = Array.from({ length: 6 }, (_, i) => [`Contents test page ${i + 1}`, 'Some text on this page.'])
writeFileSync(
  join(here, 'toc.pdf'),
  buildPdf({
    title: 'Outline Sample',
    pages: tocPages,
    outline: [
      { title: 'Part One', page: 1, children: [{ title: 'Chapter 1', page: 1 }, { title: 'Chapter 2', page: 3 }] },
      { title: 'Part Two', page: 4, children: [{ title: 'Chapter 3', page: 4 }, { title: 'Chapter 4', page: 6, named: 'ch4' }] }
    ]
  })
)
// Pages with no text at all, like a scanned book (F09.4 "no searchable text").
writeFileSync(join(here, 'no-text.pdf'), buildPdf({ title: 'Picture Only', pages: [[], [], []] }))
writeFileSync(join(here, 'corrupt.pdf'), Buffer.from('%PDF-1.7\n' + 'this is not really a pdf '.repeat(40)))
writeFileSync(join(here, 'not-a-book.txt'), 'Just a text file.\n')

// ---------- EPUB (stored ZIP, no compression) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipStored(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of files) {
    const data = Buffer.from(content, 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuf, end])
}

const chapterTitles = ['Chapter One: The Beginning', 'Chapter Two: The Middle', 'Chapter Three: The End']
const para = (c, p) =>
  `<p>Chapter ${c + 1}, paragraph ${p + 1}. The quick brown fox jumps over the lazy dog while the reader turns the pages of this sample book, which exists only to test pagination, locations and search.</p>`

function buildEpub({ title, drm = false, fontObfuscation = false, toc = true, styled = false }) {
  const chapters = chapterTitles.map((t, c) => {
    // Chapter 2 carries an inline script and an internet image: both must be blocked by the app.
    const extra =
      c === 1
        ? `<script>document.documentElement.setAttribute('data-epub-script-ran', 'yes')</script>
<p><img src="https://example.com/tracker.png" alt="remote image"/></p>`
        : c === 2
          ? '<p>Accents: a CAFÉ with crème brûlée near the end.</p>' // search must ignore case and accents
          : ''
    return [
      `OEBPS/ch${c + 1}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><title>${t}</title>${styled ? '<link rel="stylesheet" type="text/css" href="book.css"/>' : ''}</head>
<body><h1>${t}</h1>${extra}${Array.from({ length: 40 }, (_, p) => para(c, p)).join('\n')}</body></html>`
    ]
  })
  const files = [
    ['mimetype', 'application/epub+zip'],
    ...(styled
      ? [
          // What Project Gutenberg books do: their own black-on-white colours on body (bug B004).
          ['OEBPS/book.css', 'body { color: black; background-color: white; margin: 0.5em } p { color: #222 } h1 { color: #003366 }'],
        ]
      : []),
    [
      'META-INF/container.xml',
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
    ],
    [
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:ebook-reader-${drm ? 'drm' : 'sample'}</dc:identifier>
<dc:title>${title}</dc:title><dc:creator>Ebook Reader tests</dc:creator><dc:language>en</dc:language>
<meta property="dcterms:modified">2026-10-04T00:00:00Z</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${styled ? '<item id="css" href="book.css" media-type="text/css"/>' : ''}
${chapterTitles.map((_, c) => `<item id="ch${c + 1}" href="ch${c + 1}.xhtml" media-type="application/xhtml+xml"${c === 1 ? ' properties="scripted"' : ''}/>`).join('\n')}
</manifest><spine>${chapterTitles.map((_, c) => `<itemref idref="ch${c + 1}"/>`).join('')}</spine></package>`
    ],
    [
      'OEBPS/nav.xhtml',
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>
${toc ? chapterTitles.map((t, c) => `<li><a href="ch${c + 1}.xhtml">${t}</a></li>`).join('\n') : ''}
</ol></nav></body></html>`
    ],
    ...chapters
  ]
  if (fontObfuscation) {
    // Legal font obfuscation only: the book must still open.
    files.push([
      'META-INF/encryption.xml',
      `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/>
<enc:CipherData><enc:CipherReference URI="OEBPS/fonts/font.otf"/></enc:CipherData></enc:EncryptedData></encryption>`
    ])
  }
  if (drm) {
    files.push([
      'META-INF/encryption.xml',
      `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/>
<enc:CipherData><enc:CipherReference URI="OEBPS/ch1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>`
    ])
  }
  return zipStored(files)
}

writeFileSync(join(here, 'sample.epub'), buildEpub({ title: 'Sample EPUB Book' }))
writeFileSync(join(here, 'styled.epub'), buildEpub({ title: 'Book With Its Own Colours', styled: true }))
writeFileSync(join(here, 'no-toc.epub'), buildEpub({ title: 'Book Without Contents', toc: false }))
writeFileSync(join(here, 'font-obfuscated.epub'), buildEpub({ title: 'Font Obfuscated Book', fontObfuscation: true }))
writeFileSync(join(here, 'drm.epub'), buildEpub({ title: 'Locked Book', drm: true }))
writeFileSync(join(here, 'corrupt.epub'), Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('not a real zip '.repeat(50))]))
console.log('fixtures written to', here)
