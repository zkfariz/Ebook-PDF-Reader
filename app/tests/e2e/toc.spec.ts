// S6 acceptance: F10.1–F10.4 (table of contents) + sidebar toggle/memory.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const tree = () => page.getByRole('tree', { name: 'Table of contents' })
const entry = (label: string) => tree().getByRole('button', { name: label, exact: true })
const current = () => tree().locator('[aria-current="location"]')
const sidebar = () => page.getByRole('complementary', { name: 'Sidebar' })
const status = () => page.locator('.status-bar')

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

async function openEpub(name: string) {
  await openViaDialog(app, page, fixture(name))
  await expect(status()).toHaveText(/^Location/)
  await waitReady(page)
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F10.1 a PDF outline is shown as a nested tree, in order', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await expect(page.getByRole('tab', { name: 'Contents' })).toHaveAttribute('aria-selected', 'true')
  await expect(tree().getByRole('button', { name: /^(Part|Chapter)/ })).toHaveText([
    'Part One',
    'Chapter 1',
    'Chapter 2',
    'Part Two',
    'Chapter 3',
    'Chapter 4'
  ])
  // Nesting: the chapters sit inside their part's group.
  const partOne = tree()
    .getByRole('treeitem')
    .filter({ has: page.getByRole('button', { name: 'Part One', exact: true }) })
  await expect(partOne.getByRole('group').getByRole('button', { name: 'Chapter 2', exact: true })).toBeVisible()
})

test('F10.2 clicking entries jumps there (explicit and named destinations); keys go back to the page', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await entry('Chapter 2').click()
  await expectPage(page, '3 / 6')
  await entry('Chapter 4').click() // named destination
  await expectPage(page, '6 / 6')
  await entry('Part Two').click()
  await expectPage(page, '4 / 6')
  await page.keyboard.press('ArrowRight') // focus returned to the page
  await expectPage(page, '5 / 6')
})

test('nested levels can be collapsed and expanded', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await page.getByRole('button', { name: 'Collapse Part One' }).click()
  await expect(entry('Chapter 1')).toBeHidden()
  await expect(entry('Chapter 3')).toBeVisible()
  await page.getByRole('button', { name: 'Expand Part One' }).click()
  await expect(entry('Chapter 1')).toBeVisible()
})

test('F10.4 the current chapter is highlighted and follows the reader (PDF)', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await expect(current()).toHaveText('Chapter 1')
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 6')
  await expect(current()).toHaveText('Chapter 1') // chapter 2 starts on page 3
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '3 / 6')
  await expect(current()).toHaveText('Chapter 2')
  await page.keyboard.press('End')
  await expectPage(page, '6 / 6')
  await expect(current()).toHaveText('Chapter 4')
})

test('F10.1 + F10.2 + F10.4 EPUB contents: list, jump, highlight follows', async () => {
  await start()
  await openEpub('sample.epub')
  await expect(tree().getByRole('button')).toHaveText([
    'Chapter One: The Beginning',
    'Chapter Two: The Middle',
    'Chapter Three: The End'
  ])
  await expect(current()).toHaveText('Chapter One: The Beginning')

  await entry('Chapter Three: The End').click()
  await expect(current()).toHaveText('Chapter Three: The End')
  const frame = () => page.frames().find((f) => f.url().startsWith('blob:'))
  await expect.poll(() => frame()?.evaluate(() => document.querySelector('h1')?.textContent).catch(() => '')).toBe(
    'Chapter Three: The End'
  )

  await page.keyboard.press('Home')
  await expect(current()).toHaveText('Chapter One: The Beginning')
})

test('F10.3 books without contents say so (PDF and EPUB)', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await expect(sidebar()).toContainText('This book has no table of contents.')
  await page.getByRole('button', { name: '⟵ Library' }).click()
  await openEpub('no-toc.epub')
  await expect(sidebar()).toContainText('This book has no table of contents.')
})

test('sidebar toggles with ☰ and Ctrl+\\, is remembered, and is hidden in full screen', async () => {
  await start()
  await openViaDialog(app, page, fixture('toc.pdf'))
  await expectPage(page, '1 / 6')
  await expect(sidebar()).toBeVisible()
  await page.keyboard.press('Control+\\')
  await expect(sidebar()).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sidebar' })).toHaveAttribute('aria-expanded', 'false')

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Outline Sample' }).click()
  await expectPage(page, '1 / 6')
  await expect(sidebar()).toBeHidden() // remembered

  await page.getByRole('button', { name: 'Sidebar' }).click()
  await expect(sidebar()).toBeVisible()
  await page.keyboard.press('F11')
  await expect(sidebar()).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(sidebar()).toBeVisible()
})

test('all sidebar tabs fit inside the sidebar with their full labels', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  const side = (await sidebar().boundingBox())!
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText(['Contents', 'Bookmarks', 'Highlights', 'Search'])
  for (let i = 0; i < 4; i++) {
    const tab = tabs.nth(i)
    const box = (await tab.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(side.x + side.width + 0.5)
    expect(await tab.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true) // not cut off
  }
})
