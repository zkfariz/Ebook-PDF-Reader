// S9 acceptance: F11.1–F11.5 (highlights) for PDF and EPUB.
import { expect, test, type ElectronApplication, type Frame, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const popup = () => page.getByRole('toolbar', { name: 'Highlight' })
const list = () => page.getByRole('list', { name: 'Highlights' })
const pdfMarks = () => page.locator('.pdf-marks .hl-mark')
const LINE = 'The quick brown fox jumps over the lazy dog.'

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

/** Drags the mouse across a PDF text-layer span, like a reader selecting a line. */
async function selectPdfLine(text = LINE) {
  const span = page.locator('.textLayer span', { hasText: text }).first()
  await expect(span).toBeAttached()
  const b = (await span.boundingBox())!
  await page.mouse.move(b.x + 1, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
}

/** Window rectangle of the first occurrence of `text` inside the EPUB section frame. */
async function epubTextRect(frame: Frame, text: string) {
  const r = await frame.evaluate((t) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent!.indexOf(t)
      if (i < 0) continue
      const range = document.createRange()
      range.setStart(n, i)
      range.setEnd(n, i + t.length)
      const rect = [...range.getClientRects()].find((x) => x.width > 0 && x.right > 0 && x.left < innerWidth)
      if (rect) return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    }
    return null
  }, text)
  const frameBox = (await (await frame.frameElement()).boundingBox())!
  return r && { x: frameBox.x + r.x, y: frameBox.y + r.y, w: r.w, h: r.h }
}

const bookFrame = () => page.frames().find((f) => f.url().startsWith('blob:'))!

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F11.1 PDF: select text → popup → yellow → highlighted and listed', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await selectPdfLine()
  await expect(popup()).toBeVisible()
  await popup().getByRole('button', { name: 'Highlight yellow' }).click()
  await expect(popup()).toBeHidden()
  await expect(pdfMarks().first()).toHaveClass(/hl-yellow/)

  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(list().locator('.highlight-quote')).toHaveText([`“${LINE}”`])
  await expect(list().locator('.highlight-where')).toHaveText(['p. 1'])
})

test('F11.2 PDF: the highlight stays on the same words after zoom, resize and restart', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Highlight green' }).click()
  await expect(pdfMarks().first()).toBeVisible()

  /** The highlight box and the line of text must cover the same area (within 3 px). */
  const sameAsLine = async () => {
    const mark = await pdfMarks().first().boundingBox()
    const line = await page.locator('.textLayer span', { hasText: LINE }).first().boundingBox()
    if (!mark || !line) return false
    return Math.abs(mark.x - line.x) < 3 && Math.abs(mark.width - line.width) < 3 && Math.abs(mark.y - line.y) < 3
  }
  await expect.poll(sameAsLine).toBe(true)

  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+=')
  await expect.poll(sameAsLine).toBe(true)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1000, 720))
  await expect.poll(sameAsLine).toBe(true)

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Sample Three Pages' }).click()
  await expectPage(page, '1 / 3')
  await expect(pdfMarks().first()).toHaveClass(/hl-green/)
  await expect.poll(sameAsLine).toBe(true)
})

test('F11.3 PDF: click a highlight → change colour, then Delete removes it from page and list', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Highlight yellow' }).click()
  await expect(pdfMarks().first()).toBeVisible()

  const box = (await pdfMarks().first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(popup().getByRole('button', { name: 'Highlight yellow' })).toHaveAttribute('aria-pressed', 'true')
  await popup().getByRole('button', { name: 'Highlight pink' }).click()
  await expect(pdfMarks().first()).toHaveClass(/hl-pink/)

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await popup().getByRole('button', { name: 'Delete' }).click()
  await expect(pdfMarks()).toHaveCount(0)
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toContainText('No highlights yet.')
})

test('Copy puts the selected text on the clipboard', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Copy' }).click()
  await expect(popup()).toBeHidden()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(LINE)
})

test('F11.4 a selection that runs off the page is refused with a message', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await expect(page.locator('.textLayer span').first()).toBeAttached()
  // From the page text into the sidebar: not one page any more.
  await page.evaluate(() => {
    const span = document.querySelector('.textLayer span')!.firstChild!
    const outside = document.querySelector('.sidebar')!
    window.getSelection()!.setBaseAndExtent(span, 0, outside, 0)
    document.querySelector('.pdf-sheet')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(popup()).toContainText('Select text on one page at a time')
  await page.keyboard.press('Escape')
  await expect(popup()).toBeHidden()
})

test('F11.5 a page without text cannot be selected: no popup', async () => {
  await start()
  await openViaDialog(app, page, fixture('no-text.pdf'))
  await expectPage(page, '1 / 3')
  const c = (await page.locator('.pdf-page canvas').boundingBox())!
  await page.mouse.move(c.x + 50, c.y + 80)
  await page.mouse.down()
  await page.mouse.move(c.x + c.width - 50, c.y + 120, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await expect(popup()).toBeHidden()
})

test('EPUB: highlight words, they stay highlighted after a text-size change and a restart', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample.epub'))
  await expect(page.locator('.status-bar')).toHaveText(/^Location/)
  await waitReady(page)

  const words = 'quick brown fox'
  let r = (await epubTextRect(bookFrame(), words))!
  await page.mouse.move(r.x + 1, r.y + r.h / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.w - 1, r.y + r.h / 2, { steps: 8 })
  await page.mouse.up()
  await expect(popup()).toBeVisible()
  await popup().getByRole('button', { name: 'Highlight blue' }).click()
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(list().locator('.highlight-quote')).toHaveText([`“${words}”`])
  await expect(list().locator('.highlight-where')).toHaveText(['Chapter One: The Beginning'])

  /** Clicking the words opens the popup for an existing highlight = the highlight is drawn there. */
  const clickWordsShowsHighlight = async () => {
    await page.keyboard.press('Escape')
    // After a text-size change the words move while the book re-flows: wait until they stay put.
    let now = (await epubTextRect(bookFrame(), words))!
    await expect
      .poll(async () => {
        const prev = now
        await page.waitForTimeout(150)
        now = (await epubTextRect(bookFrame(), words))!
        return Math.abs(prev.x - now.x) + Math.abs(prev.y - now.y)
      })
      .toBeLessThan(1)
    await page.mouse.click(now.x + now.w / 2, now.y + now.h / 2)
    await expect(popup().getByRole('button', { name: 'Highlight blue' })).toHaveAttribute('aria-pressed', 'true')
  }
  await test.step('click check: right after highlighting', clickWordsShowsHighlight)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(page.getByLabel('Text size')).toHaveText('20px')
  await page.waitForTimeout(600)
  await test.step('click check: after A+', clickWordsShowsHighlight)

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Sample EPUB Book' }).click()
  await waitReady(page)
  await expect(list().locator('.highlight-quote')).toHaveText([`“${words}”`])
  r = (await epubTextRect(bookFrame(), words))!
  await test.step('click check: after restart', clickWordsShowsHighlight)
})
