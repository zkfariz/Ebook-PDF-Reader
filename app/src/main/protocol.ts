import { isAbsolute, join, normalize, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

// The production renderer is served from app://bundle/ instead of file://.
// file:// is an opaque origin: pdf.js's module worker and fetch() of its fonts/wasm do not work there.
export const APP_ORIGIN = 'app://bundle'

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

export function serveAppProtocol(rootDir: string): void {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.host !== 'bundle') return new Response('Not found', { status: 404 })

    const filePath = normalize(join(rootDir, decodeURIComponent(url.pathname)))
    const rel = relative(rootDir, filePath)
    if (rel.startsWith('..') || isAbsolute(rel)) return new Response('Forbidden', { status: 403 })

    return net.fetch(pathToFileURL(filePath).toString())
  })
}
