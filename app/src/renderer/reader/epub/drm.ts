// DRM detection (architecture §7): an EPUB whose META-INF/encryption.xml encrypts anything other
// than fonts (font obfuscation is legal and harmless) is copy-protected and cannot be shown.

const FONT_OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'])

/** Pure check on the encryption.xml text (unit-tested). */
export function encryptionXmlMeansDrm(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return true // unreadable encryption info: treat as locked
  const items = [...doc.getElementsByTagNameNS('*', 'EncryptedData')]
  return items.some((item) => {
    const method = item.getElementsByTagNameNS('*', 'EncryptionMethod')[0]?.getAttribute('Algorithm') ?? ''
    return !FONT_OBFUSCATION.has(method)
  })
}

export async function epubHasDrm(file: Blob): Promise<boolean> {
  const { configure, ZipReader, BlobReader, TextWriter } = await import('foliate-js/vendor/zip.js')
  configure({ useWebWorkers: false })
  const reader = new ZipReader(new BlobReader(file))
  try {
    const entry = (await reader.getEntries()).find((e) => e.filename === 'META-INF/encryption.xml')
    if (!entry) return false
    return encryptionXmlMeansDrm(await entry.getData(new TextWriter()))
  } finally {
    await reader.close()
  }
}
