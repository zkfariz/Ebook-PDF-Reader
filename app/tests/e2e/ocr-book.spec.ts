// S14 acceptance: F16.3 (whole book: progress, keep reading, Cancel), F16.5 (the search button),
// F16.7 (interrupted run keeps finished pages and can be continued).
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'
import { makeScannedCopy } from './scanHelper'

test.setTimeout(180_000)

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const notice = () => page.locator('.ocr-notice')
const noticeButton = (name: string) => notice().getByRole('button', { name })

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

async function goToPage(n: number) {
  const box = page.getByLabel('Page number')
  await box.fill(String(n))
  await box.press('Enter')
}

/** How many pages of this book have been recognised and saved (counting pages found blank too). */
const savedPages = (bookId: string) =>
  page.evaluate(async (id) => Object.keys((await window.api.ocr.get(id)).pages).length, bookId)

/** The "done" number in "Recognising the book: 3 of 8 pages". */
async function doneCount(total: number): Promise<number> {
  const text = (await notice().textContent()) ?? ''
  const m = new RegExp(`: (\\d+) of ${total} pages`).exec(text)
  return m ? Number(m[1]) : -1
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app?.close()
})

test('F16.3 recognise the whole book: progress shows, reading carries on meanwhile, then everything is searchable', async () => {
  await start()
  await openViaDialog(app, page, fixture('scanned.pdf'))
  await expectPage(page, '1 / 3')
  await noticeButton('Recognise the whole book').click()
  await expect(notice()).toHaveAttribute('data-state', 'book-running')
  await expect(notice()).toContainText(/Recognising the book: \d of 3 pages\. You can keep reading\./)

  // The reader is not frozen: pages can be turned while it works.
  await goToPage(2)
  await expectPage(page, '2 / 3')

  await expect(notice()).toHaveAttribute('data-state', 'book-finished', { timeout: 120_000 })
  await expect(notice()).toHaveText('Finished. 3 pages read.')

  // Both pages with text are searchable now; the blank one says so.
  await page.keyboard.press('Control+F')
  await page.getByLabel('Search in book').fill('Paddington')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Search results' }).locator('.search-where')).toHaveText(['p. 1'])
  await page.getByLabel('Search in book').fill('Boscombe')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Search results' }).locator('.search-where')).toHaveText(['p. 2'])
  await goToPage(3)
  await expectPage(page, '3 / 3')
  await expect(notice()).toHaveText('No text found on this page.')
})

test('F16.5 the search panel offers to recognise the whole book', async () => {
  await start()
  await openViaDialog(app, page, fixture('scanned.pdf'))
  await expectPage(page, '1 / 3')
  await page.keyboard.press('Control+F')
  await page.getByLabel('Search in book').fill('Paddington')
  await page.keyboard.press('Enter')
  await expect(page.locator('.search-status')).toHaveText('This book has no searchable text. Recognise it to search.')
  await page.getByRole('complementary').getByRole('button', { name: 'Recognise the whole book' }).click()
  await expect(notice()).toHaveAttribute('data-state', 'book-finished', { timeout: 120_000 })

  await page.getByLabel('Search in book').fill('Paddington')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Search results' }).locator('.search-result')).toHaveCount(1)
})

test('F16.3 Cancel stops the run; the pages read so far are kept and the run can be continued', async () => {
  const book = makeScannedCopy(8)
  await start()
  await openViaDialog(app, page, book.path)
  await expectPage(page, '1 / 8')
  await noticeButton('Recognise the whole book').click()
  await expect.poll(() => doneCount(8), { timeout: 90_000 }).toBeGreaterThanOrEqual(1)
  await noticeButton('Cancel').click()
  await expect(notice()).toHaveAttribute('data-state', 'book-finished', { timeout: 60_000 })
  await expect(notice()).toContainText(/Stopped\. \d of 8 pages were read\./)

  // Cancel really stopped it: the number of saved pages stays put and is less than the whole book.
  const kept = await savedPages(book.bookId)
  expect(kept).toBeGreaterThanOrEqual(1)
  expect(kept).toBeLessThan(8)
  await page.waitForTimeout(8000)
  expect(await savedPages(book.bookId)).toBe(kept)

  // Continue: only the rest is read.
  await noticeButton('Continue').click()
  await expect(notice()).toHaveAttribute('data-state', 'book-finished', { timeout: 120_000 })
  await expect(notice()).toHaveText(`Finished. ${8 - kept} ${8 - kept === 1 ? 'page' : 'pages'} read.`)
  expect(await savedPages(book.bookId)).toBe(8)
})

test('F16.7 quitting in the middle of a run keeps the finished pages; the run can be continued', async () => {
  const book = makeScannedCopy(8)
  await start()
  await openViaDialog(app, page, book.path)
  await expectPage(page, '1 / 8')
  await noticeButton('Recognise the whole book').click()
  await expect.poll(() => doneCount(8), { timeout: 90_000 }).toBeGreaterThanOrEqual(1)
  const dir = dataDir
  await app.close() // the app is closed while the run is still going

  await start(dir)
  await page.locator('.book-link', { hasText: 'scanned-8p' }).first().click()
  await waitReady(page)
  const kept = await savedPages(book.bookId)
  expect(kept).toBeGreaterThanOrEqual(1)
  expect(kept).toBeLessThan(8)

  // A page that was not reached offers to continue; pages already read are not read again.
  await goToPage(8)
  await expectPage(page, '8 / 8')
  await expect(notice()).toContainText("This page is a picture")
  await noticeButton('Continue recognising the book').click()
  await expect(notice()).toHaveAttribute('data-state', 'book-finished', { timeout: 120_000 })
  await expect(notice()).toHaveText(`Finished. ${8 - kept} ${8 - kept === 1 ? 'page' : 'pages'} read.`)
  expect(await savedPages(book.bookId)).toBe(8)
})
