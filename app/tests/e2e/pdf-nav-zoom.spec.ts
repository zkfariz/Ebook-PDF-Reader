// S2 acceptance: spec F02.1–F02.5, F03.1–F03.2, F07.1–F07.3 for PDF.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, inkedPixels, launch, openViaDialog } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]

const zoomLabel = () => page.getByLabel('Zoom level')
const canvasBox = () => page.locator('.pdf-page canvas').boundingBox()
const pane = () => page.locator('.reader-pane')

async function openBook(name: string, expected: string) {
  await expect(page.getByText('No books yet.')).toBeVisible()
  await openViaDialog(app, page, fixture(name))
  await expectPage(page, expected)
}

test.beforeEach(async () => {
  ;({ app, page, errors } = await launch())
})

test.afterEach(async () => {
  expect(errors).toEqual([])
  await app.close()
})

test('F02.1 → / PgDn / ▶ go forward, ← / PgUp / ◀ go back', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 3')
  await page.keyboard.press('ArrowLeft')
  await expectPage(page, '1 / 3')
  await page.keyboard.press('PageDown')
  await expectPage(page, '2 / 3')
  await page.keyboard.press('PageUp')
  await expectPage(page, '1 / 3')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expectPage(page, '2 / 3')
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expectPage(page, '1 / 3')
  await page.locator('.reader-pane').focus()
  await page.keyboard.press('Space')
  await expectPage(page, '2 / 3')
  await page.keyboard.press('Shift+Space')
  await expectPage(page, '1 / 3')
})

test('F02.2 no wrap-around at the first and last page; buttons disabled there', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  await page.keyboard.press('ArrowLeft')
  await expectPage(page, '1 / 3')
  await page.keyboard.press('End')
  await expectPage(page, '3 / 3')
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '3 / 3')
})

test('F02.3 typing a page number jumps there; invalid input resets the box', async () => {
  await openBook('large-500p.pdf', '1 / 500')
  const box = page.getByLabel('Page number')
  await box.fill('120')
  await box.press('Enter')
  await expectPage(page, '120 / 500')
  for (const bad of ['0', 'abc', '501', '-3', '2.5']) {
    await box.fill(bad)
    await box.press('Enter')
    await expectPage(page, '120 / 500')
  }
  // Ctrl+G focuses the page box.
  await pane().focus()
  await page.keyboard.press('Control+G')
  await expect(box).toBeFocused()
  await page.keyboard.type('7')
  await page.keyboard.press('Enter')
  await expectPage(page, '7 / 500')
})

test('F02.4 Home / End go to the first / last page', async () => {
  await openBook('large-500p.pdf', '1 / 500')
  await page.keyboard.press('End')
  await expectPage(page, '500 / 500')
  await page.keyboard.press('Home')
  await expectPage(page, '1 / 500')
})

test('F02.5 + F03.1 zoomed-in page scrolls; one more wheel at the bottom edge goes to the next page', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  // Zoom to 200 % with Ctrl + so the page is taller than the window.
  for (let i = 0; i < 12 && (await zoomLabel().innerText()) !== '200%'; i++) {
    const before = await zoomLabel().innerText()
    await page.keyboard.press('Control+=')
    await expect(zoomLabel()).not.toHaveText(before) // one step at a time
  }
  await expect(zoomLabel()).toHaveText('200%')
  const before = await canvasBox()
  await page.mouse.move(640, 400)
  // Scroll down: still page 1 while there is page left to scroll.
  await page.mouse.wheel(0, 300)
  await expectPage(page, '1 / 3')
  expect(await pane().evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  // Scroll to the bottom, wait out the flip cool-down, then one more wheel → page 2, shown from its top.
  await pane().evaluate((el) => (el.scrollTop = el.scrollHeight))
  await page.waitForTimeout(350)
  await page.mouse.wheel(0, 100)
  await expectPage(page, '2 / 3')
  expect(await pane().evaluate((el) => el.scrollTop)).toBe(0)
  expect(before!.height).toBeGreaterThan(800)
})

test('F03.1 Ctrl +/− step through zoom levels and text stays sharp; Ctrl+0 fits the page', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  await page.getByRole('button', { name: 'Zoom out' }).click() // leave fit-page for a fixed step
  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Fit page' })).toHaveAttribute('aria-pressed', 'true')

  // Set exactly 100 %: step down to 50 %, then up through the list.
  for (let i = 0; i < 15; i++) await page.keyboard.press('Control+-')
  await expect(zoomLabel()).toHaveText('50%')
  const steps = ['67%', '75%', '90%', '100%', '110%']
  for (const s of steps) {
    await page.keyboard.press('Control+=')
    await expect(zoomLabel()).toHaveText(s)
  }
  // Sharp: canvas backing store matches CSS size × devicePixelRatio.
  const sharp = await page.locator('.pdf-page canvas').evaluate((c: HTMLCanvasElement) => {
    const css = c.getBoundingClientRect().width
    return Math.abs(c.width - Math.floor(css * window.devicePixelRatio)) <= 1
  })
  expect(sharp).toBe(true)
  expect(await inkedPixels(page)).toBeGreaterThan(500)

  // Ctrl + mouse wheel zooms too.
  await page.mouse.move(640, 400)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect(zoomLabel()).toHaveText('125%')

  await page.keyboard.press('Control+0')
  await expect(page.getByRole('button', { name: 'Fit page' })).toHaveAttribute('aria-pressed', 'true')
})

test('F03.2 Fit width keeps fitting the width when the window is resized', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  await page.getByRole('button', { name: 'Fit width' }).click()
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute('aria-pressed', 'true')

  const fits = async () => {
    const paneW = await pane().evaluate((el) => el.clientWidth)
    const box = await canvasBox()
    if (!box) return false // canvas is being swapped for a freshly drawn one
    return Math.abs(box.width - (paneW - 32)) <= 2 // 16 px margin each side
  }
  await expect.poll(fits).toBe(true)

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(900, 700))
  await expect.poll(fits).toBe(true)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1400, 900))
  await expect.poll(fits).toBe(true)
})

test('F07.1 + F07.3 exactly one page is shown, centred horizontally', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  await expect(page.locator('.pdf-page canvas')).toHaveCount(1)
  const box = (await canvasBox())!
  const paneBox = (await pane().boundingBox())!
  const leftGap = box.x - paneBox.x
  const rightGap = paneBox.x + paneBox.width - (box.x + box.width)
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2)
})

test('F07.2 no transitions or animations are active', async () => {
  await openBook('sample-3p.pdf', '1 / 3')
  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('*')].map((el) => {
      const s = getComputedStyle(el)
      return `${s.transitionDuration}|${s.animationName}`
    })
  )
  expect(styles.every((s) => /^0s(, 0s)*\|none$/.test(s))).toBe(true)
})

test('500-page PDF: paging stays fast', async () => {
  await openBook('large-500p.pdf', '1 / 500')
  const started = Date.now()
  for (let i = 2; i <= 30; i++) {
    await page.keyboard.press('ArrowRight')
    await expectPage(page, `${i} / 500`)
  }
  const perPage = (Date.now() - started) / 29
  console.log(`average time per page turn: ${perPage.toFixed(0)} ms`)
  expect(perPage).toBeLessThan(250)
})
