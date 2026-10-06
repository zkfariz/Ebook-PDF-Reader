import { describe, expect, it } from 'vitest'
import { matchShortcut } from '../../../src/renderer/app/keymap'

type KeyInit = { key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; target?: unknown }
const key = (k: KeyInit) =>
  matchShortcut({ ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, target: null, ...k } as unknown as KeyboardEvent)

describe('matchShortcut', () => {
  it('maps the spec shortcut table', () => {
    expect(key({ key: 'o', ctrlKey: true })).toBe('open')
    expect(key({ key: 'ArrowRight' })).toBe('next')
    expect(key({ key: 'PageDown' })).toBe('next')
    expect(key({ key: ' ' })).toBe('next')
    expect(key({ key: ' ', shiftKey: true })).toBe('prev')
    expect(key({ key: 'ArrowLeft' })).toBe('prev')
    expect(key({ key: 'ArrowLeft', altKey: true })).toBe('library')
    expect(key({ key: 'Home' })).toBe('first')
    expect(key({ key: 'End' })).toBe('last')
    expect(key({ key: 'g', ctrlKey: true })).toBe('goto')
    expect(key({ key: '=', ctrlKey: true })).toBe('zoom-in')
    expect(key({ key: '+', ctrlKey: true, shiftKey: true })).toBe('zoom-in')
    expect(key({ key: '-', ctrlKey: true })).toBe('zoom-out')
    expect(key({ key: '0', ctrlKey: true })).toBe('zoom-reset')
    expect(key({ key: 'ArrowDown' })).toBe('down-or-next')
  })

  it('needs the exact modifiers', () => {
    expect(key({ key: 'o' })).toBeNull()
    expect(key({ key: 'ArrowRight', ctrlKey: true })).toBeNull()
  })

  it('ignores keys while typing in a field', () => {
    expect(key({ key: 'ArrowRight', target: { tagName: 'INPUT' } })).toBeNull()
    expect(key({ key: 'Home', target: { tagName: 'TEXTAREA' } })).toBeNull()
  })
})
