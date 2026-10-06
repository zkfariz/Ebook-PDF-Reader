// S5 acceptance: F08.1–F08.4 (day/night) and F13.1–F13.3 (full screen).
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const theme = () => page.evaluate(() => document.documentElement.dataset['theme'])
const bg = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor)
const isFullScreen = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isFullScreen())
const bookFrame = () => page.frames().find((f) => f.url().startsWith('blob:'))!

// Design-system tokens (day → night) as the browser reports them.
const DAY_SURFACE = 'rgb(255, 255, 255)'
const NIGHT_SURFACE = 'rgb(31, 33, 37)'
const NIGHT_PAGE = 'rgb(27, 28, 31)'
const NIGHT_INK = 'rgb(218, 218, 218)'

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

/** Forces a known starting theme regardless of the Windows setting. */
async function setTheme(want: 'day' | 'night') {
  if ((await theme()) !== want) await page.keyboard.press('Control+Shift+N')
  await expect.poll(theme).toBe(want)
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('first launch follows the Windows light/dark setting', async () => {
  await start()
  const systemDark = await app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors)
  expect(await theme()).toBe(systemDark ? 'night' : 'day')
})

test('F08.1 toggling switches toolbar, library and page colours at once (button and Ctrl+Shift+N)', async () => {
  await start()
  await setTheme('day')
  expect(await bg('.toolbar')).toBe(DAY_SURFACE)

  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect.poll(theme).toBe('night')
  expect(await bg('.toolbar')).toBe(NIGHT_SURFACE)
  expect(await bg('body')).toBe('rgb(22, 23, 26)')
  // Electron's own controls follow too.
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors)).toBe(true)

  await page.keyboard.press('Control+Shift+N')
  await expect.poll(theme).toBe('day')
  expect(await bg('.toolbar')).toBe(DAY_SURFACE)
})

test('F08.2 night mode inverts the PDF page image, and the reader toolbar switches too', async () => {
  await start()
  await setTheme('day')
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  const filter = () => page.locator('.pdf-page canvas').evaluate((c) => getComputedStyle(c).filter)
  expect(await filter()).toBe('none')

  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect.poll(filter).toContain('invert(1)')
  expect(await bg('.toolbar')).toBe(NIGHT_SURFACE)
  // Paging in night mode keeps the inversion on new pages.
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 3')
  await expect.poll(filter).toContain('invert(1)')
})

test('F08.2 a PDF opened while night mode is already on is inverted from the start', async () => {
  await start()
  await setTheme('night')
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await expect
    .poll(() => page.locator('.pdf-page canvas').evaluate((c) => getComputedStyle(c).filter))
    .toContain('invert(1)')
})

test('F08.3 night mode gives EPUB text the night ink on the night page colour', async () => {
  await start()
  await setTheme('night')
  await openViaDialog(app, page, fixture('sample.epub'))
  await expect(page.locator('.status-bar')).toHaveText(/^Location/)
  await waitReady(page)
  const colours = () =>
    bookFrame().evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return `${s.color}|${s.backgroundColor}`
    })
  await expect.poll(colours).toBe(`${NIGHT_INK}|${NIGHT_PAGE}`)

  // Switching to day while reading re-styles the book immediately.
  await page.keyboard.press('Control+Shift+N')
  await expect.poll(colours).toBe('rgb(30, 30, 30)|rgb(255, 255, 255)')
})

test('F08.4 the chosen theme is remembered after a restart', async () => {
  await start()
  const systemDark = await app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors)
  const chosen = systemDark ? 'day' : 'night' // the opposite of Windows, to prove it is remembered
  await setTheme(chosen)
  await app.close()
  await start(dataDir)
  expect(await theme()).toBe(chosen)
})

test('F13.1 + F13.2 F11 / ⛶ enter full screen and hide the toolbar; Esc / F11 leave it', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  const toolbar = page.locator('.reader .toolbar')

  await page.keyboard.press('F11')
  await expect.poll(isFullScreen).toBe(true)
  await expect(toolbar).toBeHidden()

  await page.keyboard.press('Escape')
  await expect.poll(isFullScreen).toBe(false)
  await expect(toolbar).toBeVisible()

  await page.getByRole('button', { name: 'Full screen' }).click()
  await expect.poll(isFullScreen).toBe(true)
  await page.keyboard.press('F11')
  await expect.poll(isFullScreen).toBe(false)
})

test('F13 in full screen the toolbar appears at the top edge and hides again', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await page.keyboard.press('F11')
  await expect.poll(isFullScreen).toBe(true)
  const toolbar = page.locator('.reader .toolbar')
  await page.mouse.move(400, 300)
  await expect(toolbar).toBeHidden()
  await page.mouse.move(400, 2)
  await expect(toolbar).toBeVisible()
  await page.mouse.move(400, 400)
  await expect(toolbar).toBeHidden()
  await page.keyboard.press('Escape')
})

test('F13.3 reading shortcuts keep working in full screen (PDF and EPUB)', async () => {
  await start()
  await openViaDialog(app, page, fixture('large-500p.pdf'))
  await expectPage(page, '1 / 500')
  await page.keyboard.press('F11')
  await expect.poll(isFullScreen).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expectPage(page, '2 / 500')
  await page.keyboard.press('End')
  await expectPage(page, '500 / 500')
  await page.keyboard.press('Control+Shift+N') // theme toggle works too
  await page.keyboard.press('Escape')
  await expect.poll(isFullScreen).toBe(false)

  // Leaving the book exits full screen automatically.
  await page.keyboard.press('F11')
  await expect.poll(isFullScreen).toBe(true)
  await page.keyboard.press('Alt+ArrowLeft')
  await expect.poll(isFullScreen).toBe(false)
})

test('F08.3 EPUB page margins follow a theme switch (no dark frame around a day page)', async () => {
  // Found by the user's hand test: foliate kept the margin colour from when the chapter loaded.
  await start()
  await setTheme('night')
  await openViaDialog(app, page, fixture('sample.epub'))
  await waitReady(page)
  /** Real on-screen colour of a pixel in the left page margin. */
  const marginColour = async () => {
    const v = (await page.locator('.epub-view').boundingBox())!
    const pt = { x: Math.round(v.x + 12), y: Math.round(v.y + v.height / 2) }
    return app.evaluate(async ({ BrowserWindow }, p) => {
      const img = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage({ x: p.x, y: p.y, width: 1, height: 1 })
      const b = img.toBitmap() // BGRA
      return `rgb(${b[2]}, ${b[1]}, ${b[0]})`
    }, pt)
  }
  await expect.poll(marginColour).toBe(NIGHT_PAGE)
  await page.keyboard.press('Control+Shift+N')
  await expect.poll(marginColour).toBe('rgb(255, 255, 255)')
  await page.keyboard.press('Control+Shift+N')
  await expect.poll(marginColour).toBe(NIGHT_PAGE)
})

test('F08.3 EPUB text stays readable in night mode when the book sets its own colours (B004)', async () => {
  // Found by the user with a Project Gutenberg book: its CSS says body { color: black }, which beat
  // the night text colour, so dark text sat on the dark page. styled.epub does the same.
  await start()
  await openViaDialog(app, page, fixture('styled.epub'))
  await waitReady(page)

  /** Brightest and darkest pixel of the whole book view, as 0–255 luminance. */
  const brightestAndDarkest = async () => {
    const v = (await page.locator('.epub-view').boundingBox())!
    return app.evaluate(
      async ({ BrowserWindow }, r) => {
        const img = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage(r)
        const b = img.toBitmap() // BGRA
        let max = 0
        let min = 255
        for (let i = 0; i < b.length; i += 4) {
          const lum = 0.2126 * b[i + 2]! + 0.7152 * b[i + 1]! + 0.0722 * b[i]!
          if (lum > max) max = lum
          if (lum < min) min = lum
        }
        return { max, min }
      },
      { x: Math.round(v.x), y: Math.round(v.y), width: Math.round(v.width), height: Math.round(v.height) }
    )
  }

  await setTheme('night')
  // Light text on the dark page: something bright is on screen (dark-on-dark would stay below ~40).
  await expect.poll(async () => (await brightestAndDarkest()).max).toBeGreaterThan(150)
  await setTheme('day')
  // Dark text on the white page.
  await expect.poll(async () => (await brightestAndDarkest()).min).toBeLessThan(110)
  await setTheme('night')
  await expect.poll(async () => (await brightestAndDarkest()).max).toBeGreaterThan(150)
})
