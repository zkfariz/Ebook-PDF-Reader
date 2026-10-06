import { BOOK_EXTENSIONS, type BookFormat } from '@shared/ipc'

// Decide the format from the file's content (not just its name), so a renamed file cannot fool us.
export function sniffFormat(head: Uint8Array, fileName: string): BookFormat | null {
  if (!BOOK_EXTENSIONS.test(fileName)) return null

  // PDF: "%PDF-" must appear within the first 1 KB (some files have junk before it).
  const text = new TextDecoder('latin1').decode(head.subarray(0, 1024))
  if (text.includes('%PDF-')) return 'pdf'

  // EPUB: a ZIP file ("PK\x03\x04") with an .epub name. The engine validates the contents.
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (isZip && /\.epub$/i.test(fileName)) return 'epub'

  return null
}
