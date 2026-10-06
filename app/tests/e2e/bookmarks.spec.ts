// S7 acceptance: F06.1–F06.4 (bookmarks) for PDF and EPUB.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const toggleButton = () => page.getByRole('button', { name: 'Bookmark this page' })
const list = () => page.getByRole('list', { name: 'Bookmarks' })
const items = () => list().locator('.bookmark-label')
const sidebar = () => page.getByRole('complementary', { name: 'Sidebar' })
const status = () => page.locator('.status-bar')

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

async function showBookmarksTab() {
  await page.getByRole('tab', { name: 'Bookmarks' }).click()
}

async function openEpub() {
  await openViaDialog(app, page, fixture('sample.epub'))
  await expect(status()).toHaveText(/^Location/)
  await waitReady(page)
}

async function turn(key: 'ArrowRight' | 'ArrowLeft') {
  const before = await status().innerText()
  await page.keyboard.press(key)
  await expect(status()).not.toHaveText(before)
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F06.4 + F06.1 empty message; Ctrl+B adds a bookmark (button filled) and removes it again', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await showBookmarksTab()
  await expect(sidebar()).toContainText('No bookmarks yet. Press Ctrl+B to add one.')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'false')

  await page.locator('.reader-pane').focus()
  await page.keyboard.press('Control+B')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
  await expect(items()).toHaveText(['p. 1'])
  await expect(list()).toContainText(/Today \d\d:\d\d/)

  await page.keyboard.press('Control+B')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'false')
  await expect(sidebar()).toContainText('No bookmarks yet.')
})

test('F06.2 bookmarks are listed in book order with chapter labels; clicking jumps there', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await page.getByLabel('Page number').fill('5')
  await page.getByLabel('Page number').press('Enter')
  await expectPage(page, '5 / 6')
  await toggleButton().click() // the toolbar button works too
  await page.keyboard.press('Home')
  await expectPage(page, '1 / 6')
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 6')
  await page.keyboard.press('Control+B')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')

  await showBookmarksTab()
  await expect(items()).toHaveText(['Chapter 1 · p. 2', 'Chapter 3 · p. 5']) // book order, not creation order
  await list().locator('.bookmark-link', { hasText: 'Chapter 3 · p. 5' }).click()
  await expectPage(page, '5 / 6')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowLeft') // focus went back to the page
  await expectPage(page, '4 / 6')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'false')
})

test('F06.3 bookmarks survive an app restart; 🗑 deletes one', async () => {
  await start()
  await openViaDialog(app, page, fixture('large-500p.pdf'))
  await expectPage(page, '1 / 500')
  for (const p of ['10', '250']) {
    await page.getByLabel('Page number').fill(p)
    await page.getByLabel('Page number').press('Enter')
    await expectPage(page, `${p} / 500`)
    await page.keyboard.press('Control+B')
    await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
  }

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Large Five Hundred Pages' }).click()
  await expectPage(page, '250 / 500') // resumed on a bookmarked page
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
  await showBookmarksTab()
  await expect(items()).toHaveText(['p. 10', 'p. 250'])

  await page.getByRole('button', { name: 'Delete bookmark p. 250' }).click()
  await expect(items()).toHaveText(['p. 10'])
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'false')
})

test('EPUB: bookmark the current screen, button follows paging, label has chapter + %, survives restart', async () => {
  await start()
  await openEpub()
  await turn('ArrowRight')
  await turn('ArrowRight')
  // Ctrl+B while the keyboard focus is inside the book text.
  const box = (await page.locator('.epub-view').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+B')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
  await showBookmarksTab()
  await expect(items()).toHaveText([/^Chapter One: The Beginning · \d+%$/])

  await turn('ArrowRight')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'false')
  await turn('ArrowLeft')
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')

  const where = await status().innerText()
  await page.keyboard.press('End')
  await expect(status()).toHaveText(/100%$/)
  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Sample EPUB Book' }).click()
  await expect(status()).toHaveText(/100%$/)
  await waitReady(page)
  await expect(items()).toHaveCount(1) // the Bookmarks tab is remembered too
  await list().locator('.bookmark-link').click()
  await expect(status()).toHaveText(where)
  await expect(toggleButton()).toHaveAttribute('aria-pressed', 'true')
})
