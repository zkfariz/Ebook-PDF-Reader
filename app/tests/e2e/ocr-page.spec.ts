// S13 acceptance: F16.1, F16.2, F16.4, F16.5, F16.6, F16.8, F16.9 (recognising one page of a scanned PDF).
// scanned.pdf has no text layer: pages 1 and 2 are pictures of public-domain text, page 3 is blank.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

test.setTimeout(120_000)

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const notice = () => page.locator('.ocr-notice')
const recogniseButton = () => notice().getByRole('button', { name: 'Recognise text' })
const popup = () => page.getByRole('toolbar', { name: 'Highlight' })
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

async function openScanned(pages = '1 / 3') {
  await openViaDialog(app, page, fixture('scanned.pdf'))
  await expectPage(page, pages)
}

/** Reads the page on screen and waits until it is done (the engine needs a few seconds). */
async function recognise(state: 'recognised' | 'blank' = 'recognised') {
  await recogniseButton().click()
  await expect(notice()).toHaveAttribute('data-state', state, { timeout: 60_000 })
}

/** Goes to a page through the page box (arrow keys would act on whatever has focus, e.g. the search box). */
async function goToPage(n: number) {
  const box = page.getByLabel('Page number')
  await box.fill(String(n))
  await box.press('Enter')
}

/** Drags across the text-layer line that contains `text`, like a reader selecting it. */
async function selectLine(text: string) {
  const span = page.locator('.textLayer span', { hasText: text }).first()
  await expect(span).toBeAttached()
  const b = (await span.boundingBox())!
  await page.mouse.move(b.x + 1, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app?.close()
})

test('F16.1 a page that is only a picture offers Recognise text; a page with text shows no notice', async () => {
  await start()
  await openScanned()
  await expect(notice()).toContainText("This page is a picture, so its text can't be selected or searched.")
  await expect(recogniseButton()).toBeVisible()
  await expect(page.locator('.textLayer span')).toHaveCount(0)

  await page.keyboard.press('Control+O') // dialog is mocked below: open a normal PDF
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await expect(notice()).toHaveCount(0)
})

test('F16.2 + F16.9 recognising a page makes its text selectable and highlightable; the PDF is never changed', async () => {
  const before = sha(fixture('scanned.pdf'))
  await start()
  await openScanned()
  await recogniseButton().click()
  await expect(notice()).toHaveAttribute('data-state', 'busy') // "Reading this page…"
  await expect(notice()).toHaveText('Reading this page…')
  await expect(notice()).toHaveAttribute('data-state', 'recognised', { timeout: 60_000 })
  await expect(notice()).toHaveText('Recognised text may contain mistakes.')
  await expect(recogniseButton()).toHaveCount(0)

  // The text layer holds the recognised words.
  await expect(page.locator('.textLayer span', { hasText: 'Paddington' }).first()).toBeAttached()

  // Select a line → popup → highlight → listed.
  await selectLine('Paddington')
  await expect(popup()).toBeVisible()
  await popup().getByRole('button', { name: 'Highlight yellow' }).click()
  await expect(page.locator('.pdf-marks .hl-mark').first()).toHaveClass(/hl-yellow/)
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(page.getByRole('list', { name: 'Highlights' }).locator('.highlight-quote')).toContainText('Paddington')

  expect(sha(fixture('scanned.pdf'))).toBe(before) // F16.9: recognising never writes to the book
})

test('F16.5 + F16.4 search says how to get text, then finds words on recognised pages', async () => {
  await start()
  await openScanned()
  await page.keyboard.press('Control+F')
  await page.getByLabel('Search in book').fill('Boscombe')
  await page.keyboard.press('Enter')
  await expect(page.locator('.search-status')).toHaveText('This book has no searchable text. Recognise it to search.')

  // Recognise page 2 (the word is on it), then search again.
  await goToPage(2)
  await expectPage(page, '2 / 3')
  await recognise()
  await page.getByLabel('Search in book').fill('Boscombe')
  await page.keyboard.press('Enter')
  const hits = page.getByRole('list', { name: 'Search results' }).locator('.search-result')
  await expect(hits).toHaveCount(1)
  await expect(page.getByRole('list', { name: 'Search results' }).locator('.search-where')).toHaveText(['p. 2'])

  // Clicking the result jumps to the page and outlines the word on the page picture.
  await goToPage(1)
  await expectPage(page, '1 / 3')
  await hits.first().click()
  await expectPage(page, '2 / 3')
  await expect(page.locator('.pdf-marks .search-mark').first()).toBeVisible()
})

test('F16.6 recognised text and highlights are kept after zooming and after restarting the app', async () => {
  await start()
  await openScanned()
  await recognise()
  await selectLine('Paddington')
  await popup().getByRole('button', { name: 'Highlight yellow' }).click()
  await expect(page.locator('.pdf-marks .hl-mark').first()).toBeVisible()

  await page.keyboard.press('Control+=') // zoom in: the layers are rebuilt, the highlight must follow
  await expect(page.locator('.pdf-marks .hl-mark').first()).toBeVisible()
  await page.keyboard.press('Control+0')

  const dir = dataDir
  await app.close()
  await start(dir)
  await page.getByRole('button', { name: 'Open book…' }).first().isVisible().catch(() => undefined)
  await page.locator('.book-link', { hasText: 'scanned' }).first().click()
  await waitReady(page)
  // No second reading: the page is already recognised, with its highlight.
  await expect(notice()).toHaveAttribute('data-state', 'recognised')
  await expect(recogniseButton()).toHaveCount(0)
  await expect(page.locator('.textLayer span', { hasText: 'Paddington' }).first()).toBeAttached()
  await expect(page.locator('.pdf-marks .hl-mark').first()).toHaveClass(/hl-yellow/)
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(page.getByRole('list', { name: 'Highlights' }).locator('.highlight-quote')).toContainText('Paddington')
})

test('F16.8 a blank page says "No text found", and is not read again after a restart', async () => {
  await start()
  await openScanned()
  await page.keyboard.press('End')
  await expectPage(page, '3 / 3')
  await expect(notice()).toContainText("This page is a picture")
  await recognise('blank')
  await expect(notice()).toHaveText('No text found on this page.')

  const dir = dataDir
  await app.close()
  await start(dir)
  await page.locator('.book-link', { hasText: 'scanned' }).first().click()
  await waitReady(page)
  await expectPage(page, '3 / 3')
  await expect(notice()).toHaveText('No text found on this page.')
  await expect(recogniseButton()).toHaveCount(0)
})
