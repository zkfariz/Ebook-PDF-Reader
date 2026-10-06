// S10 acceptance: F12.1–F12.3 (notes on highlights) for PDF and EPUB.
import { expect, test, type ElectronApplication, type Frame, type Page } from '@playwright/test'
import { expectPage, fixture, launch, newDataDir, openViaDialog, waitReady } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string

const LINE = 'The quick brown fox jumps over the lazy dog.'
const popup = () => page.getByRole('toolbar', { name: 'Highlight' })
const editor = () => page.getByRole('dialog', { name: 'Note' })
const noteBox = () => editor().getByLabel('Note text')
const listNotes = () => page.getByRole('list', { name: 'Highlights' }).locator('.highlight-note')
const pdfMarks = () => page.locator('.pdf-marks .hl-mark')
const markers = () => page.locator('.pdf-marks .note-marker')

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  await expect(page.locator('.toolbar .title').first()).toHaveText('Ebook Reader')
}

async function openSamplePdf() {
  await openViaDialog(app, page, fixture('sample-3p.pdf'))
  await expectPage(page, '1 / 3')
  await page.getByRole('tab', { name: 'Highlights' }).click()
}

async function selectPdfLine(text = LINE) {
  const span = page.locator('.textLayer span', { hasText: text }).first()
  await expect(span).toBeAttached()
  const b = (await span.boundingBox())!
  await page.mouse.move(b.x + 1, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(popup()).toBeVisible()
}

/** Clicks the middle of the first highlight box on the PDF page. */
async function clickPdfHighlight() {
  const box = (await pdfMarks().first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(popup()).toBeVisible()
}

/** Window rectangle of `text` inside the EPUB section frame (first occurrence on screen). */
async function epubTextRect(frame: Frame, text: string) {
  const r = await frame.evaluate((t) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent!.indexOf(t)
      if (i < 0) continue
      const range = document.createRange()
      range.setStart(n, i)
      range.setEnd(n, i + t.length)
      const rect = [...range.getClientRects()].find((x) => x.width > 0)
      if (rect) return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    }
    return null
  }, text)
  const frameBox = (await (await frame.frameElement()).boundingBox())!
  return { x: frameBox.x + r!.x, y: frameBox.y + r!.y, w: r!.w, h: r!.h }
}
const bookFrame = () => page.frames().find((f) => f.url().startsWith('blob:'))!

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app.close()
})

test('F12.1 PDF: Note on new text makes a yellow highlight with a note, a ✎ marker and a list entry', async () => {
  await start()
  await openSamplePdf()
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Note' }).click()
  await expect(noteBox()).toBeFocused()
  await page.keyboard.type('Remember this sentence.')
  await page.keyboard.press('Control+Enter') // saves
  await expect(editor()).toBeHidden()

  await expect(pdfMarks().first()).toHaveClass(/hl-yellow/)
  await expect(pdfMarks().first()).toHaveClass(/has-note/)
  await expect(markers()).toHaveCount(1)
  await expect(listNotes()).toHaveText(['✎ Remember this sentence.'])

  // Hovering the highlight shows the note as a tooltip.
  const box = (await pdfMarks().first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.pdf-sheet')).toHaveAttribute('title', 'Remember this sentence.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200)
  await expect(page.locator('.pdf-sheet')).not.toHaveAttribute('title')
})

test('F12.1 Note on an existing highlight; Esc cancels without saving', async () => {
  await start()
  await openSamplePdf()
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Highlight green' }).click()
  await clickPdfHighlight()
  await popup().getByRole('button', { name: 'Note' }).click()
  await expect(noteBox()).toHaveValue('')
  await page.keyboard.type('Not saved')
  await page.keyboard.press('Escape')
  await expect(editor()).toBeHidden()
  await expect(listNotes()).toHaveCount(0)
  await expect(markers()).toHaveCount(0)

  await clickPdfHighlight()
  await popup().getByRole('button', { name: 'Note' }).click()
  await noteBox().fill('Green note')
  await editor().getByRole('button', { name: 'Save' }).click()
  await expect(listNotes()).toHaveText(['✎ Green note'])
  await expect(pdfMarks().first()).toHaveClass(/hl-green/) // colour unchanged
})

test('F12.2 editing a note; saving it empty removes the note but keeps the highlight', async () => {
  await start()
  await openSamplePdf()
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Note' }).click()
  await noteBox().fill('First version')
  await page.keyboard.press('Control+Enter')
  await expect(listNotes()).toHaveText(['✎ First version'])

  await clickPdfHighlight()
  await popup().getByRole('button', { name: 'Note' }).click()
  await expect(noteBox()).toHaveValue('First version')
  await noteBox().fill('Second version')
  await page.keyboard.press('Control+Enter')
  await expect(listNotes()).toHaveText(['✎ Second version'])

  await clickPdfHighlight()
  await popup().getByRole('button', { name: 'Note' }).click()
  await noteBox().fill('   ')
  await editor().getByRole('button', { name: 'Save' }).click()
  await expect(listNotes()).toHaveCount(0)
  await expect(markers()).toHaveCount(0)
  await expect(pdfMarks()).toHaveCount(1) // the highlight itself is still there
  await expect(pdfMarks().first()).not.toHaveClass(/has-note/)
})

test('F12.3 notes survive an app restart (PDF)', async () => {
  await start()
  await openSamplePdf()
  await selectPdfLine()
  await popup().getByRole('button', { name: 'Note' }).click()
  await noteBox().fill('Still here after restart')
  await page.keyboard.press('Control+Enter')
  await expect(listNotes()).toHaveText(['✎ Still here after restart'])

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Sample Three Pages' }).click()
  await expectPage(page, '1 / 3')
  await expect(listNotes()).toHaveText(['✎ Still here after restart']) // the Highlights tab is remembered
  await expect(markers()).toHaveCount(1)
  await clickPdfHighlight()
  await popup().getByRole('button', { name: 'Note' }).click()
  await expect(noteBox()).toHaveValue('Still here after restart')
})

test('EPUB: add a note, hover shows it, edit it, and it survives a restart', async () => {
  await start()
  await openViaDialog(app, page, fixture('sample.epub'))
  await waitReady(page)
  await page.getByRole('tab', { name: 'Highlights' }).click()

  const words = 'quick brown fox'
  const r = await epubTextRect(bookFrame(), words)
  await page.mouse.move(r.x + 1, r.y + r.h / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.w - 1, r.y + r.h / 2, { steps: 8 })
  await page.mouse.up()
  await popup().getByRole('button', { name: 'Note' }).click()
  await noteBox().fill('An EPUB note')
  await page.keyboard.press('Control+Enter')
  await expect(listNotes()).toHaveText(['✎ An EPUB note'])

  // Hover tooltip inside the book text.
  await expect
    .poll(async () => {
      const now = await epubTextRect(bookFrame(), words)
      await page.mouse.move(now.x + now.w / 2, now.y + now.h / 2)
      return bookFrame().evaluate(() => document.documentElement.getAttribute('title'))
    })
    .toBe('An EPUB note')

  await app.close()
  await start(dataDir)
  await page.locator('.book-link', { hasText: 'Sample EPUB Book' }).click()
  await waitReady(page)
  await expect(listNotes()).toHaveText(['✎ An EPUB note'])
  const again = await epubTextRect(bookFrame(), words)
  await page.mouse.click(again.x + again.w / 2, again.y + again.h / 2)
  await popup().getByRole('button', { name: 'Note' }).click()
  await expect(noteBox()).toHaveValue('An EPUB note')
  await noteBox().fill('Edited EPUB note')
  await page.keyboard.press('Control+Enter')
  await expect(listNotes()).toHaveText(['✎ Edited EPUB note'])
})
