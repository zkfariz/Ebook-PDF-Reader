// S8 acceptance: F09.1–F09.5 (word search) for PDF and EPUB.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]

const box = () => page.getByLabel('Search in book')
const statusLine = () => page.locator('.search-status')
const results = () => page.getByRole('list', { name: 'Search results' }).locator('.search-result')
const where = () => page.getByRole('list', { name: 'Search results' }).locator('.search-where')
const marks = () => page.locator('.pdf-marks .search-mark')

async function searchFor(q: string) {
  await box().fill(q)
  await box().press('Enter')
}

async function openPdf(name: string, pages: string) {
  await openViaDialog(app, page, fixture(name))
  await expectPage(page, pages)
}

async function openEpub() {
  await openViaDialog(app, page, fixture('sample.epub'))
  await expect(page.locator('.status-bar')).toHaveText(/^Location/)
  await waitReady(page)
}

test.beforeEach(async () => {
  ;({ app, page, errors } = await launch())
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
})

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F09.1 Ctrl+F opens Search with the cursor in the box; results show snippet + page', async () => {
  await openPdf('sample-3p.pdf', '1 / 3')
  await page.keyboard.press('Control+F')
  await expect(page.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true')
  await expect(box()).toBeFocused()
  await page.keyboard.type('Quick BROWN')
  await page.keyboard.press('Enter')
  await expect(statusLine()).toHaveText('3 results')
  await expect(where()).toHaveText(['p. 1', 'p. 2', 'p. 3'])
  await expect(results().first().locator('strong')).toHaveText('quick brown')
  await expect(results().first()).toContainText('The quick brown fox jumps')
})

test('F09 search ignores case and accents', async () => {
  await openPdf('sample-3p.pdf', '1 / 3')
  await page.getByRole('button', { name: 'Search', exact: true }).click() // the 🔍 button works too
  await expect(box()).toBeFocused()
  await searchFor('creme BRULEE')
  await expect(statusLine()).toHaveText('1 result')
  await expect(results().first().locator('strong')).toHaveText('crème brûlée')
  await searchFor('cafe')
  await expect(where()).toHaveText(['p. 2'])
})

test('F09.2 clicking a result jumps there and outlines the match; Enter / Shift+Enter step through', async () => {
  await openPdf('sample-3p.pdf', '1 / 3')
  await page.keyboard.press('Control+F')
  await searchFor('lazy dog')
  await expect(statusLine()).toHaveText('3 results')

  await results().nth(2).click()
  await expectPage(page, '3 / 3')
  await expect(marks().first()).toBeVisible()
  // The outline sits on the page, over the matched words.
  const mark = (await marks().first().boundingBox())!
  const canvas = (await page.locator('.pdf-page canvas').boundingBox())!
  expect(mark.x).toBeGreaterThan(canvas.x)
  expect(mark.x + mark.width).toBeLessThan(canvas.x + canvas.width)
  expect(mark.width).toBeGreaterThan(10)

  await box().focus()
  await box().press('Enter') // after the 3rd result: wraps to the 1st
  await expectPage(page, '1 / 3')
  await box().press('Enter')
  await expectPage(page, '2 / 3')
  await box().press('Shift+Enter')
  await expectPage(page, '1 / 3')
  await expect(marks()).toHaveCount(1)
})

test('F09.3 no results says so; fewer than 2 characters asks for more', async () => {
  await openPdf('sample-3p.pdf', '1 / 3')
  await page.keyboard.press('Control+F')
  await searchFor('zebra')
  await expect(statusLine()).toHaveText("No results for 'zebra'")
  await box().fill('a')
  await expect(statusLine()).toHaveText('Type at least 2 characters.')
})

test('F09.4 a PDF without any text explains that it cannot be searched', async () => {
  await openPdf('no-text.pdf', '1 / 3')
  await page.keyboard.press('Control+F')
  await searchFor('anything')
  await expect(statusLine()).toHaveText('This book has no searchable text (it may be scanned).')
})

test('F09.5 500-page PDF: first results within 2 s, no freezing, capped at 500, clearing cancels', async () => {
  await openPdf('large-500p.pdf', '1 / 500')
  await page.keyboard.press('Control+F')
  // Watch for frozen frames while searching.
  await page.evaluate(() => {
    const w = window as unknown as { maxGap: number; watching: boolean }
    w.maxGap = 0
    w.watching = true
    let last = performance.now()
    const tick = (t: number) => {
      w.maxGap = Math.max(w.maxGap, t - last)
      last = t
      if (w.watching) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const started = Date.now()
  await searchFor('quick brown') // 24 matches on each of 500 pages
  await expect(results().first()).toBeVisible({ timeout: 2000 })
  console.log(`first results after ${Date.now() - started} ms`)
  await expect(statusLine()).toHaveText('500 results · Showing first 500 results', { timeout: 30_000 })
  await expect(results()).toHaveCount(500)
  const maxGap = await page.evaluate(() => {
    const w = window as unknown as { maxGap: number; watching: boolean }
    w.watching = false
    return w.maxGap
  })
  console.log(`longest frame gap while searching: ${Math.round(maxGap)} ms`)
  expect(maxGap).toBeLessThan(500)

  // Clearing the box cancels and empties the list.
  await searchFor('lazy dog')
  await box().fill('')
  await expect(results()).toHaveCount(0)
  await expect(statusLine()).toHaveText('')
})

test('EPUB: search across chapters, labels by chapter, click jumps to the passage', async () => {
  await openEpub()
  await page.keyboard.press('Control+F')
  await expect(box()).toBeFocused()
  await searchFor('creme BRULEE')
  await expect(statusLine()).toHaveText('1 result')
  await expect(where()).toHaveText(['Chapter Three: The End'])
  await expect(results().first().locator('strong')).toHaveText('crème brûlée')

  await results().first().click()
  const frame = () => page.frames().find((f) => f.url().startsWith('blob:'))
  await expect
    .poll(() => frame()?.evaluate(() => document.querySelector('h1')?.textContent).catch(() => ''))
    .toBe('Chapter Three: The End')
  await expect(page.locator('.status-bar')).toHaveText(/Location \d+ of/)

  await searchFor('lazy dog')
  await expect(statusLine()).toHaveText('120 results')
  await expect(where().first()).toHaveText('Chapter One: The Beginning')
  await expect(where().last()).toHaveText('Chapter Three: The End')

  // Results stay when switching tabs.
  await page.getByRole('tab', { name: 'Contents' }).click()
  await page.getByRole('tab', { name: 'Search' }).click()
  await expect(results()).toHaveCount(120)
})
