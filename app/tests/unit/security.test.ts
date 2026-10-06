import { describe, expect, it } from 'vitest'
import { isAllowedUrl } from '../../src/main/security'

describe('isAllowedUrl (offline enforcement)', () => {
  it('allows local schemes', () => {
    expect(isAllowedUrl('app://bundle/index.html')).toBe(true)
    expect(isAllowedUrl('file:///C:/app/index.html')).toBe(true)
    expect(isAllowedUrl('blob:file:///1234')).toBe(true)
    expect(isAllowedUrl('data:image/png;base64,AAAA')).toBe(true)
  })

  it('blocks the internet in production', () => {
    expect(isAllowedUrl('https://example.com/')).toBe(false)
    expect(isAllowedUrl('http://localhost:5173/')).toBe(false)
  })

  it('allows only the dev server in development', () => {
    const dev = 'http://localhost:5173/'
    expect(isAllowedUrl('http://localhost:5173/src/main.tsx', dev)).toBe(true)
    expect(isAllowedUrl('ws://localhost:5173/', dev)).toBe(true)
    expect(isAllowedUrl('http://localhost:8080/', dev)).toBe(false)
    expect(isAllowedUrl('https://fonts.googleapis.com/css', dev)).toBe(false)
  })

  it('rejects unparseable urls', () => {
    expect(isAllowedUrl('not a url')).toBe(false)
  })
})
