import { describe, expect, it } from 'vitest'
import { fileFromArgv, isLaunchData } from '../../src/main/openRequests'

// F15: the book path Windows passes on the command line ("Open with", double-click).
describe('fileFromArgv', () => {
  it('reads the file after the exe in the installed app', () => {
    expect(fileFromArgv(['C:\\App\\Ebook Reader.exe', 'D:\\Books\\My Book.pdf'], 'C:\\', false)).toBe(
      'D:\\Books\\My Book.pdf'
    )
  })

  it('skips the app folder when run through electron (dev and tests)', () => {
    expect(fileFromArgv(['electron.exe', '.', 'D:\\b.epub'], 'C:\\', true)).toBe('D:\\b.epub')
    expect(fileFromArgv(['electron.exe', '.'], 'C:\\', true)).toBeNull()
  })

  it('ignores Chromium/Electron switches wherever they are', () => {
    const argv = ['app.exe', '--allow-file-access-from-files', 'D:\\b.pdf', '--original-process-start-time=1']
    expect(fileFromArgv(argv, 'C:\\', false)).toBe('D:\\b.pdf')
  })

  it('returns null without a file', () => {
    expect(fileFromArgv(['app.exe'], 'C:\\', false)).toBeNull()
    expect(fileFromArgv(['app.exe', '--squirrel-firstrun'], 'C:\\', false)).toBeNull()
  })

  it('resolves a relative path against the working folder of the launch', () => {
    expect(fileFromArgv(['app.exe', 'b.pdf'], 'D:\\Books', false)).toBe('D:\\Books\\b.pdf')
  })

  it('passes non-book files on (the page shows the plain message)', () => {
    expect(fileFromArgv(['app.exe', 'D:\\notes.txt'], 'C:\\', false)).toBe('D:\\notes.txt')
  })
})

describe('isLaunchData', () => {
  it('accepts only { argv: string[], cwd: string }', () => {
    expect(isLaunchData({ argv: ['a'], cwd: 'C:\\' })).toBe(true)
    expect(isLaunchData({ argv: [1], cwd: 'C:\\' })).toBe(false)
    expect(isLaunchData(null)).toBe(false)
    expect(isLaunchData({})).toBe(false)
  })
})
