// S3 acceptance for EPUB: F01.1–F01.3, F02.1/2/4, F03.3, F07.1/2, plus content security.
import { expect, test, type ElectronApplication, type Frame, type Page } from '@playwright/test'
import { fixture, launch, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]

const status = () => page.locator('.status-bar')
const LABEL = /^Location (\d+) of (\d+) · (\d+)%$/

async function progress(): Promise<{ current: number; total: number; percent: number }> {
  const m = LABEL.exec(await status().innerText())
  if (!m) throw new Error('bad status label')
  return { current: Number(m[1]), total: Number(m[2]), percent: Number(m[3]) }
}

/** Waits until the status label differs from `before`. */
async function changedFrom(before: string) {
  await expect(status()).not.toHaveText(before, { timeout: 5000 })
}

const bookFrame = (): Frame => {
  const f = page.frames().find((fr) => fr.url().startsWith('blob:'))
  if (!f) throw new Error('no book frame')
  return f
}

/** Runs fn in the current book frame; '' while foliate is swapping one section's frame for the next. */
const inBook = <T>(fn: () => T) =>
  Promise.resolve()
    .then(() => bookFrame().evaluate(fn))
    .catch(() => '' as T)

async function openSample(name = 'sample.epub', title = 'Sample EPUB Book') {
  const started = Date.now()
  await openViaDialog(app, page, fixture(name))
  await expect(page.locator('.toolbar .title')).toHaveText(title)
  await expect(status()).toHaveText(LABEL)
  await waitReady(page)
  return Date.now() - started
}

test.beforeEach(async () => {
  ;({ app, page, errors } = await launch())
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test.afterEach(async () => {
  // The sample book deliberately contains an inline script and an internet image; the CSP
  // blocking them is expected. Anything else is a real error.
  const unexpected = errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))
  expect(unexpected).toEqual([])
  await app.close()
})

test('F01.1 opens an EPUB within 3 s with title and location label', async () => {
  expect(await openSample()).toBeLessThan(3000)
  const p = await progress()
  expect(p.current).toBe(1)
  expect(p.total).toBeGreaterThan(5)
  await expect(page.getByLabel('Location number')).toHaveValue('1')
})

test('F01.3 a DRM-protected EPUB shows the copy-protection message', async () => {
  await openViaDialog(app, page, fixture('drm.epub'))
  await expect(page.getByRole('dialog')).toContainText("copy-protected (DRM) and can't be opened")
  await page.keyboard.press('Enter')
  await expect(page.getByText('No books yet.')).toBeVisible()
})

test('F01.3 a corrupt EPUB shows the damaged-file message', async () => {
  await openViaDialog(app, page, fixture('corrupt.epub'))
  await expect(page.getByRole('dialog')).toContainText('could not be opened')
})

test('font obfuscation alone is not mistaken for DRM', async () => {
  await openSample('font-obfuscated.epub', 'Font Obfuscated Book')
})

test('F02.1 → / PgDn / ▶ forward and ← / PgUp / ◀ back, also with focus inside the book text', async () => {
  await openSample()
  for (const [key, dir] of [
    ['ArrowRight', 1],
    ['ArrowLeft', -1],
    ['PageDown', 1],
    ['PageUp', -1]
  ] as const) {
    const before = await progress()
    const text = await status().innerText()
    await page.keyboard.press(key)
    await changedFrom(text)
    const after = await progress()
    expect(Math.sign(after.percent - before.percent)).toBe(dir)
  }
  let text = await status().innerText()
  await page.getByRole('button', { name: 'Next page' }).click()
  await changedFrom(text)

  // Click into the page text (a real mouse click on the visible page), then use the keyboard there.
  const box = (await page.locator('.epub-view').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  expect(await bookFrame().evaluate(() => document.hasFocus())).toBe(true)
  const before = await progress()
  text = await status().innerText()
  await page.keyboard.press('ArrowRight')
  await changedFrom(text)
  expect((await progress()).percent).toBeGreaterThan(before.percent)
})

test('F02.2 + F02.4 Home/End; no wrap-around; buttons disabled at the ends', async () => {
  await openSample()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  let text = await status().innerText()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(400)
  await expect(status()).toHaveText(text)

  await page.keyboard.press('End')
  await expect(status()).toHaveText(/· 100%$/)
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  text = await status().innerText()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  await expect(status()).toHaveText(text)

  await page.keyboard.press('Home')
  await expect(status()).toHaveText(/^Location 1 of/)
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
})

test('location box jumps to a location number', async () => {
  await openSample()
  const box = page.getByLabel('Location number')
  await box.fill('8')
  await box.press('Enter')
  // A screen starts at or just before the requested location.
  await expect.poll(async () => (await progress()).current).toBeGreaterThanOrEqual(7)
  expect((await progress()).current).toBeLessThanOrEqual(8)
})

test('F03.3 A+ makes text larger, reflows, and keeps the reading position', async () => {
  await openSample()
  for (let i = 0; i < 6; i++) {
    const t = await status().innerText()
    await page.keyboard.press('ArrowRight')
    await changedFrom(t)
  }
  const before = await progress()
  const fontBefore = await bookFrame().evaluate(() => getComputedStyle(document.body).fontSize)
  expect(fontBefore).toBe('18px')

  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(page.getByLabel('Text size')).toHaveText('20px')
  await expect.poll(() => bookFrame().evaluate(() => getComputedStyle(document.body).fontSize)).toBe('20px')
  await page.waitForTimeout(500)
  const after = await progress()
  // Same place in the text, ± one screen (about 3 % in this small book).
  expect(Math.abs(after.percent - before.percent)).toBeLessThanOrEqual(4)

  // Ctrl − back down, Ctrl+0 resets to 18 px; font toggle switches the family.
  await page.keyboard.press('Control+-')
  await page.keyboard.press('Control+-')
  await expect(page.getByLabel('Text size')).toHaveText('16px')
  await page.keyboard.press('Control+0')
  await expect(page.getByLabel('Text size')).toHaveText('18px')
  await page.getByRole('button', { name: 'Font' }).click()
  await expect(page.getByRole('button', { name: 'Font' })).toHaveText('Sans')
  await expect.poll(() => bookFrame().evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Segoe UI')
})

test('F07.1 + F07.2 single column, no spread, no animations in the book text', async () => {
  await openSample()
  const columns = await page.evaluate(() =>
    (document.querySelector('foliate-view') as HTMLElement & { renderer: HTMLElement }).renderer.getAttribute('max-column-count')
  )
  expect(columns).toBe('1')
  const animated = await page.evaluate(() =>
    (document.querySelector('foliate-view') as HTMLElement & { renderer: HTMLElement }).renderer.hasAttribute('animated')
  )
  expect(animated).toBe(false)
  const styles = await bookFrame().evaluate(() =>
    [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).transitionDuration)
  )
  expect(styles.every((s) => /^0s(, 0s)*$/.test(s))).toBe(true)
})

test('scripts inside EPUBs do not run and internet images are not loaded', async () => {
  await openSample()
  const responses: string[] = []
  page.on('response', (r) => responses.push(r.url()))
  // Walk to chapter 2, which contains the planted script and remote image.
  for (let i = 0; i < 30; i++) {
    const h1 = await inBook(() => document.querySelector('h1')?.textContent ?? '')
    if (h1.includes('Two')) break
    const t = await status().innerText()
    await page.keyboard.press('ArrowRight')
    await changedFrom(t)
  }
  await expect.poll(() => inBook(() => document.querySelector('h1')?.textContent ?? '')).toContain('Two')
  expect(await inBook(() => document.documentElement.getAttribute('data-epub-script-ran') ?? 'no')).toBe('no')
  // The image request is refused by the content security policy before anything is sent.
  await expect.poll(() => errors.some((e) => e.includes('tracker.png') && e.includes('Content Security Policy'))).toBe(true)
  await page.waitForTimeout(300)
  expect(responses.filter((r) => r.includes('example.com'))).toEqual([])
})

test('mouse wheel turns EPUB pages (one page per flick); Ctrl+wheel changes text size', async () => {
  // B003, found by the user's hand test: the wheel did nothing in EPUBs.
  await openSample()
  const box = (await page.locator('.epub-view').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2) // over the book text (inside its frame)

  const start = await progress()
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await progress()).percent).toBeGreaterThan(start.percent)
  const afterOne = await progress()
  await page.waitForTimeout(400) // past the cool-down
  await page.mouse.wheel(0, -120)
  await expect.poll(async () => (await progress()).percent).toBeLessThan(afterOne.percent)

  // A burst of wheel events (a fast flick) turns exactly one page.
  await page.waitForTimeout(400)
  const before = await progress()
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 40)
  await page.waitForTimeout(600)
  const pageStep = afterOne.percent - start.percent
  expect((await progress()).percent - before.percent).toBeLessThanOrEqual(pageStep + 1)

  // Over the page margin (outside the text frame) it works too.
  await page.mouse.move(box.x + 6, box.y + box.height / 2)
  await page.waitForTimeout(400)
  const m = await progress()
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await progress()).percent).toBeGreaterThan(m.percent)

  // Ctrl + wheel = text size.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  await expect(page.getByLabel('Text size')).toHaveText('20px')
})
