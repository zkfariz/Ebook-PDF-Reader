// S12 (F16 plumbing): the OCR engine runs inside the locked-down app window without any network use,
// and recognised pages are stored through IPC. The reader UI for OCR is tested in S13/S14.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launch, newDataDir } from './helpers'

let app: ElectronApplication
let page: Page
let errors: string[]
let dataDir: string
let mainLog: string[]

const bookId = 'a'.repeat(64)

async function start(dir = newDataDir()) {
  ;({ app, page, errors, dataDir } = await launch(dir))
  mainLog = []
  // The main process's console (the offline blocker logs every cancelled request there).
  app.on('console', (m) => mainLog.push(m.text()))
  await expect(page.locator('.toolbar .title')).toHaveText('Ebook Reader')
}

test.afterEach(async () => {
  expect(errors.filter((e) => !/Executing inline script|tracker\.png/.test(e))).toEqual([])
  await app?.close()
})

test('F16.10 the OCR engine reads a picture of text in the real window, with no network use', async () => {
  await start()
  const chunk = readdirSync(join(__dirname, '..', '..', 'out', 'renderer', 'assets')).find((f) => f.startsWith('OcrEngine-'))
  expect(chunk, 'the OCR engine is built as its own chunk').toBeTruthy()

  // Control: a forbidden request is logged by the offline blocker, so an empty log below really means "none".
  // (Sent from the main process: a request from the page would already be stopped by the page's CSP.)
  await app.evaluate(({ session }) => session.defaultSession.fetch('https://example.com/').catch(() => undefined))
  await expect.poll(() => mainLog.some((l) => l.includes('[offline] blocked https://example.com'))).toBe(true)
  mainLog.length = 0

  const result = await page.evaluate(async (chunkName) => {
    // A picture of text, drawn here (no file needed).
    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = 360
    const g = canvas.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.fillStyle = '#000'
    g.font = '56px Georgia, serif'
    g.fillText('The quick brown fox jumps', 60, 120)
    g.fillText('over the lazy dog 1234', 60, 240)
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))

    const mod = await import(/* @vite-ignore */ `app://bundle/assets/${chunkName}`)
    const engine = new mod.OcrEngine()
    const lines = await engine.recognise(blob)
    await engine.dispose()
    return lines as { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[]
  }, chunk)

  expect(result.map((l) => l.text.trim()).join(' ')).toMatch(/quick brown fox jumps/i)
  expect(result.map((l) => l.text.trim()).join(' ')).toMatch(/lazy dog 1234/i)
  // Boxes are in bitmap pixels, inside the 1400 x 360 picture, the first line above the second.
  expect(result.length).toBeGreaterThanOrEqual(2)
  expect(result[0]!.bbox.x1).toBeLessThanOrEqual(1400)
  expect(result[1]!.bbox.y0).toBeGreaterThan(result[0]!.bbox.y0)
  // Nothing tried to leave the app: the offline blocker never had to cancel a request.
  expect(mainLog.filter((l) => l.includes('[offline] blocked'))).toEqual([])
})

test('F16 recognised pages are saved through IPC and are still there after a restart', async () => {
  await start()
  await page.evaluate(async (id) => {
    await window.api.ocr.putPage(id, 12, [{ t: 'My experience of camp life', b: [44.1, 40.2, 389.5, 52] }])
    await window.api.ocr.putPage(id, 13, []) // recognised, nothing readable
  }, bookId)
  const dir = dataDir
  await app.close() // closing saves, as in normal use

  await start(dir)
  const ocr = await page.evaluate((id) => window.api.ocr.get(id), bookId)
  expect(ocr.pages['12']!.lines[0]!.t).toBe('My experience of camp life')
  expect(ocr.pages['13']).toEqual({ lines: [] })
})

test('F16 the app refuses malformed OCR data and bad book ids', async () => {
  await start()
  const outcome = await page.evaluate(async (id) => {
    const tryIt = (p: Promise<unknown>) => p.then(() => 'accepted', () => 'rejected')
    return {
      badId: await tryIt(window.api.ocr.get('../../evil')),
      badPage: await tryIt(window.api.ocr.putPage(id, 0, [])),
      badLine: await tryIt(window.api.ocr.putPage(id, 1, [{ t: '', b: [0, 0, 1, 1] }])),
      badBox: await tryIt(window.api.ocr.putPage(id, 1, [{ t: 'x', b: [0, 0, 1] } as never])),
      good: await tryIt(window.api.ocr.putPage(id, 1, [{ t: 'x', b: [0, 0, 1, 1] }]))
    }
  }, bookId)
  expect(outcome).toEqual({ badId: 'rejected', badPage: 'rejected', badLine: 'rejected', badBox: 'rejected', good: 'accepted' })
})
