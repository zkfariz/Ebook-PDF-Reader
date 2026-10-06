// S4 acceptance: F04.1–F04.4 (library), F05.1–F05.3 (resume), F01.5 (missing file), F03.4 (view per book).
import { copyFileSync, existsSync, mkdtempSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, hardKill, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const rows = () => page.locator('.library-list tbody tr')
/** The clickable title of a book in the library list. */
const bookLink = (title: string) => page.locator('.book-link', { hasText: title })
const status = () => page.locator('.status-bar')

/** Copies a fixture to a temp folder so tests can move/rename it freely. */
function copyFixture(name: string, as = name): string {
  const dir = mkdtempSync(join(tmpdir(), 'ebook-book-'))
  const path = join(dir, as)
  copyFileSync(fixture(name), path)
  return path
}

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title')).toHaveText('Ebook Reader')
}

/** Closes the app the normal way (lets it save) and starts it again with the same data. */
async function restart() {
  await app.close()
  await start(dataDir)
}

async function backToLibrary() {
  await page.getByRole('button', { name: '⟵ Library' }).click()
  await expect(page.locator('.library-list, .library-empty')).toBeVisible()
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F04.4 an empty library shows the empty state with Open book…', async () => {
  await start()
  await expect(page.getByText('No books yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open book…' })).toBeVisible()
})

test('F04.1 opened books appear newest first with title, author, type and progress', async () => {
  await start()
  await openViaDialog(app, page, copyFixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await backToLibrary()
  await openViaDialog(app, page, copyFixture('sample.epub'))
  await expect(status()).toHaveText(/^Location 1 of/)
  await backToLibrary()

  await expect(rows()).toHaveCount(2)
  await expect(rows().nth(0)).toContainText('Sample EPUB Book')
  await expect(rows().nth(0)).toContainText('Ebook Reader tests')
  await expect(rows().nth(0)).toContainText('EPUB')
  await expect(rows().nth(0)).toContainText(/Today \d\d:\d\d/)
  await expect(rows().nth(1)).toContainText('Sample Three Pages')
  await expect(rows().nth(1)).toContainText('PDF')

  // Clicking a title opens it.
  await bookLink('Sample Three Pages').click()
  await expectPage(page, '1 / 3')
})

test('F05.1 + F03.4 a PDF reopens at the last page and zoom after restarting the app', async () => {
  await start()
  await openViaDialog(app, page, copyFixture('large-500p.pdf'))
  await expectPage(page, '1 / 500')
  const box = page.getByLabel('Page number')
  await box.fill('87')
  await box.press('Enter')
  await expectPage(page, '87 / 500')
  await page.getByRole('button', { name: 'Fit width' }).click()
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute('aria-pressed', 'true')

  await restart()
  await expect(rows().nth(0)).toContainText('17%') // 86 / 499 pages
  await bookLink('Large Five Hundred Pages').click()
  await expectPage(page, '87 / 500')
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute('aria-pressed', 'true')
})

test('F05.2 + F03.4 an EPUB reopens at the same passage and text size, even with another window size', async () => {
  await start()
  await openViaDialog(app, page, copyFixture('sample.epub'))
  await expect(status()).toHaveText(/^Location 1 of/)
  await waitReady(page)
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(page.getByLabel('Text size')).toHaveText('20px')
  for (let i = 0; i < 8; i++) {
    const t = await status().innerText()
    await page.keyboard.press('ArrowRight')
    await expect(status()).not.toHaveText(t)
  }
  const before = await status().innerText()
  const firstWords = await page
    .frames()
    .find((f) => f.url().startsWith('blob:'))!
    .evaluate(() => {
      // The first paragraph that is at least partly visible in the current page.
      const ps = [...document.querySelectorAll('p')]
      const vis = ps.find((p) => {
        const r = p.getBoundingClientRect()
        return r.right > 0 && r.left < innerWidth && r.bottom > 0
      })
      return vis?.textContent?.slice(0, 30) ?? ''
    })

  await restart()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1000, 760))
  await bookLink('Sample EPUB Book').click()
  await expect(status()).toHaveText(/^Location/)
  await waitReady(page)
  await expect(page.getByLabel('Text size')).toHaveText('20px')
  const pct = (s: string) => Number(/(\d+)%$/.exec(s)![1])
  expect(Math.abs(pct(await status().innerText()) - pct(before))).toBeLessThanOrEqual(4)
  // The passage that was on screen is still on screen.
  const text = await page
    .frames()
    .find((f) => f.url().startsWith('blob:'))!
    .evaluate(() => document.body.innerText)
  expect(text).toContain(firstWords)
})

test('F05.3 the position is saved on every page change (survives a hard kill)', async () => {
  await start()
  await openViaDialog(app, page, copyFixture('large-500p.pdf'))
  await expectPage(page, '1 / 500')
  for (let i = 2; i <= 6; i++) {
    await page.keyboard.press('ArrowRight')
    await expectPage(page, `${i} / 500`)
  }
  await page.waitForTimeout(300) // give the write a moment to reach the disk
  await hardKill(app, dataDir) // no chance to save on exit
  await start(dataDir)
  await bookLink('Large Five Hundred Pages').click()
  // At most one page change out of date (spec F05.3); in practice it is exact.
  await expect.poll(async () => Number(await page.getByLabel('Page number').inputValue())).toBeGreaterThanOrEqual(5)
})

test('F04.2 removing a book asks first, deletes its data, keeps the file', async () => {
  await start()
  const path = copyFixture('sample-3p.pdf')
  await openViaDialog(app, page, path)
  await expectPage(page, '1 / 3')
  await backToLibrary()
  await page.getByRole('button', { name: 'Remove Sample Three Pages from library' }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove from library?' })
  await expect(dialog).toContainText('not touched')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(rows()).toHaveCount(1)

  await page.getByRole('button', { name: 'Remove Sample Three Pages from library' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No books yet.')).toBeVisible()
  expect(existsSync(path)).toBe(true)
  expect(existsSync(join(dataDir, 'books'))).toBe(true)
  const { readdirSync } = await import('node:fs')
  expect(readdirSync(join(dataDir, 'books'))).toEqual([])
})

test('F04.3 a renamed/moved file is still one entry with its progress', async () => {
  await start()
  const path = copyFixture('large-500p.pdf')
  await openViaDialog(app, page, path)
  await page.getByLabel('Page number').fill('40')
  await page.getByLabel('Page number').press('Enter')
  await expectPage(page, '40 / 500')
  await backToLibrary()

  const moved = join(mkdtempSync(join(tmpdir(), 'ebook-moved-')), 'renamed-book.pdf')
  renameSync(path, moved)
  await openViaDialog(app, page, moved)
  await expectPage(page, '40 / 500') // same book (same content) → same reading data
  await backToLibrary()
  await expect(rows()).toHaveCount(1)
})

test('F01.5 a missing file offers Locate file… and reconnects the reading data', async () => {
  await start()
  const path = copyFixture('large-500p.pdf')
  await openViaDialog(app, page, path)
  await page.getByLabel('Page number').fill('33')
  await page.getByLabel('Page number').press('Enter')
  await expectPage(page, '33 / 500')
  await backToLibrary()

  const moved = join(mkdtempSync(join(tmpdir(), 'ebook-moved-')), 'moved.pdf')
  renameSync(path, moved)
  await restart() // the list now flags the file as missing
  await expect(rows().nth(0)).toContainText('(file not found)')

  await bookLink('Large Five Hundred Pages').click()
  const dialog = page.getByRole('dialog', { name: 'File not found' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Remove from library' })).toBeVisible()

  await app.evaluate(({ dialog: d }, p) => {
    d.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [p] })) as typeof d.showOpenDialog
  }, moved)
  await dialog.getByRole('button', { name: 'Locate file…' }).click()
  await expectPage(page, '33 / 500')
  await backToLibrary()
  await expect(rows()).toHaveCount(1)
  await expect(rows().nth(0)).not.toContainText('file not found')
})

test('F01.5 Remove from library is offered for a missing file', async () => {
  await start()
  const path = copyFixture('sample-3p.pdf')
  await openViaDialog(app, page, path)
  await expectPage(page, '1 / 3')
  await backToLibrary()
  renameSync(path, `${path}.gone`)
  await restart()
  await bookLink('Sample Three Pages').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove from library' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test('window size and position are remembered', async () => {
  await start()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setBounds({ x: 120, y: 90, width: 1010, height: 600 }))
  // Windows may round or clamp what we asked for: compare with what it actually applied.
  const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds())
  await restart()
  const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds())
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[k] - before[k])).toBeLessThanOrEqual(2)
  expect(after.x).toBeGreaterThan(50) // really moved, not the default position
})
