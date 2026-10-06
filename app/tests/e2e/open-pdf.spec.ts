// S1 acceptance: spec F01.1–F01.4 for PDF.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, inkedPixels, launch, openViaDialog } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]

test.beforeEach(async () => {
  ;({ app, page, errors } = await launch())
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test.afterEach(async () => {
  await app.close()
})

test('F01.1 Ctrl+O opens a PDF and renders page 1 within 3 s', async () => {
  const started = Date.now()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expect(page.locator('.toolbar .title')).toHaveText('Sample Three Pages')
  await expectPage(page, '1 / 3')
  expect(Date.now() - started).toBeLessThan(3000)

  // Canvas is backed at device-pixel resolution (sharp) and actually has text drawn on it.
  const size = await page.locator('.pdf-page canvas').evaluate((c: HTMLCanvasElement) => ({
    backing: c.width,
    css: c.getBoundingClientRect().width,
    dpr: window.devicePixelRatio
  }))
  expect(size.backing).toBeGreaterThanOrEqual(Math.floor(size.css * size.dpr) - 1)
  expect(await inkedPixels(page)).toBeGreaterThan(500)
  expect(errors).toEqual([])
})

test('back to library returns to the library, which now lists the book', async () => {
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await page.getByRole('button', { name: '⟵ Library' }).click()
  await expect(page.locator('.library-list')).toContainText('Sample Three Pages')
})

test('F01.2 dropping a non-book file shows a message and changes nothing', async () => {
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('dialog')).toContainText('Only PDF and EPUB files are supported.')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test('F01.2 choosing a non-book file shows the same message', async () => {
  await openViaDialog(app, page, fixture('not-a-book.txt'))
  await expect(page.getByRole('dialog')).toContainText('Only PDF and EPUB files are supported.')
})

test('F01.3 a corrupt PDF shows an error and returns to the library', async () => {
  await openViaDialog(app, page, fixture('corrupt.pdf'))
  await expect(page.getByRole('dialog')).toContainText('could not be opened')
  await page.keyboard.press('Enter')
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test('F01.4 a password PDF asks for the password, rejects a wrong one, opens with the right one', async () => {
  await openViaDialog(app, page, fixture('protected.pdf'))
  const dialog = page.getByRole('dialog', { name: 'Password required' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Password').fill('wrong')
  await page.keyboard.press('Enter')
  await expect(dialog.getByText('Incorrect password')).toBeVisible()

  await dialog.getByLabel('Password').fill('test')
  await page.keyboard.press('Enter')
  await expect(page.locator('.toolbar .title')).toHaveText('Protected Sample')
  await expectPage(page, '1 / 1')
  expect(await inkedPixels(page)).toBeGreaterThan(500)
})

test('F01.4 cancelling the password prompt returns to the library', async () => {
  await openViaDialog(app, page, fixture('protected.pdf'))
  await expect(page.getByRole('dialog', { name: 'Password required' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('No books yet.')).toBeVisible()
})
