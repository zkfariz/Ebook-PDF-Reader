// Offline enforcement (architecture.md §3): only local schemes may load.
// In development, the Vite dev server origin is also allowed (http + ws for hot reload).

const LOCAL_SCHEMES = new Set(['app:', 'file:', 'blob:', 'data:', 'devtools:', 'chrome-extension:'])

export function isAllowedUrl(url: string, devServerUrl?: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (LOCAL_SCHEMES.has(parsed.protocol)) return true
  if (!devServerUrl) return false

  const dev = new URL(devServerUrl)
  const sameHost = parsed.hostname === dev.hostname && parsed.port === dev.port
  return sameHost && ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)
}
