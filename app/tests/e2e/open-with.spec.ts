// F15 acceptance: books opened from File Explorer arrive on the command line.
// F15.1 and F15.5 (the Explorer menu and uninstall) need the installed app and are hand-tested.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const title = () => page.locator('.toolbar .title')
const dialog = () => page.getByRole('dialog')

/** Starts a second copy of the app, as Windows does when a book is double-clicked; resolves with its exit code. */
function secondInstance(dir: string, file: string): Promise<number | null> {
  const child = spawn(electronPath as unknown as string, ['.', file], {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, EBOOK_READER_USER_DATA: dir },
    stdio: 'ignore'
  })
  return new Promise((done) => child.on('exit', (code) => done(code)))
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app?.close()
})

test('F15.2 a book on the command line opens directly, at its saved position', async () => {
  ;({ app, page, errors, dataDir } = await launch(newDataDir(), [fixture('sample-3p.pdf')]))
  await expectPage(page, '1 / 3')
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 3')
  await app.close()

  ;({ app, page, errors } = await launch(dataDir, [fixture('sample-3p.pdf')]))
  await expectPage(page, '2 / 3')
  await expect(title()).toHaveText('Sample Three Pages')
})

test('F15.2 an EPUB on the command line opens directly', async () => {
  ;({ app, page, errors, dataDir } = await launch(newDataDir(), [fixture('sample.epub')]))
  await waitReady(page)
  await expect(page.locator('.status-bar')).toContainText('Location')
})

test('F15.3 a book opened while the app runs uses the same window, from the library or another book', async () => {
  ;({ app, page, errors, dataDir } = await launch())
  await expect(page.locator('.library-empty')).toBeVisible()

  // From the library.
  expect(await secondInstance(dataDir, fixture('sample-3p.pdf'))).toBe(0)
  await expectPage(page, '1 / 3')
  expect(app.windows()).toHaveLength(1)

  // While another book is open, and with the window minimised.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.minimize())
  expect(await secondInstance(dataDir, fixture('sample.epub'))).toBe(0)
  await waitReady(page)
  await expect(page.locator('.status-bar')).toContainText('Location')
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMinimized()))
    .toBe(false)
  expect(app.windows()).toHaveLength(1)
})

test('F15.3 opening the book already on screen keeps the current page', async () => {
  ;({ app, page, errors, dataDir } = await launch())
  await expect(page.locator('.library-empty')).toBeVisible()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 3')
  expect(await secondInstance(dataDir, fixture('sample-3p.pdf'))).toBe(0)
  // Give the request time to arrive, then check nothing moved.
  await page.waitForTimeout(800)
  await expectPage(page, '2 / 3')
})

test('F15.4 a missing, damaged or non-book file shows the plain message on the library', async () => {
  const cases: [string, RegExp][] = [
    [join(newDataDir(), 'gone.pdf'), /File not found/],
    [fixture('corrupt.pdf'), /damaged|could not|can't/i],
    [fixture('not-a-book.txt'), /Only PDF and EPUB/]
  ]
  for (const [file, message] of cases) {
    ;({ app, page, errors, dataDir } = await launch(newDataDir(), [file]))
    await expect(dialog()).toContainText(message)
    await dialog().getByRole('button').first().click()
    await expect(page.locator('.library-empty, .library-list')).toBeVisible()
    await expect(title()).toHaveText('Ebook Reader')
    await app.close()
  }
  ;({ app, page, errors } = await launch(dataDir)) // afterEach closes this one
})
