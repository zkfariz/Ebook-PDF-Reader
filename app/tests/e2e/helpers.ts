import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'

export const fixture = (name: string) => join(__dirname, '..', 'fixtures', name)

/** A fresh, empty app-data folder (library, settings, reading data). */
export const newDataDir = () => mkdtempSync(join(tmpdir(), 'ebook-reader-e2e-'))

/**
 * Starts the app with its own data folder, so tests never see each other's (or the user's) books.
 * Pass the same `dataDir` again to simulate restarting the app.
 * `extraArgs` go on the command line, like a book opened from File Explorer (F15).
 */
export async function launch(
  dataDir = newDataDir(),
  extraArgs: string[] = []
): Promise<{ app: ElectronApplication; page: Page; errors: string[]; dataDir: string }> {
  const app = await electron.launch({ args: ['.', ...extraArgs], env: { ...process.env, EBOOK_READER_USER_DATA: dataDir } })
  const page = await app.firstWindow()
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return { app, page, errors, dataDir }
}

/**
 * Hard-kills the app (no chance to save) and waits until it is completely gone.
 * app.process() is only Playwright's launcher: the real app (and its GPU/network/renderer
 * helpers) would keep running, and since F15 it would also keep the single-instance lock.
 * So everything is found through the helpers, which carry the test's data folder on their
 * command line, and their parent (the app itself).
 */
export async function hardKill(app: ElectronApplication, dataDir: string): Promise<void> {
  const proc = app.process()
  const exited = new Promise((r) => proc.once('exit', r))
  const dir = basename(dataDir).replace(/'/g, '')
  const script = [
    `$helpers = @(Get-CimInstance Win32_Process -Filter "name='electron.exe'" | Where-Object { $_.CommandLine -like '*${dir}*' })`,
    '$ids = @($helpers.ParentProcessId) + @($helpers.ProcessId) | Sort-Object -Unique',
    'foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }'
  ].join('; ')
  execFileSync('powershell', ['-NoProfile', '-Command', script])
  proc.kill('SIGKILL')
  await exited
  await new Promise((r) => setTimeout(r, 300))
}

/** Makes the next Open dialog "choose" this file, then presses Ctrl+O. */
export async function openViaDialog(app: ElectronApplication, page: Page, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [p] })) as typeof dialog.showOpenDialog
  }, filePath)
  await page.keyboard.press('Control+O')
}

/** Number of non-white pixels on the page canvas: > 0 means something was actually drawn. */
export async function inkedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.pdf-page canvas')
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return -1
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let n = 0
    for (let i = 0; i < data.length; i += 4) if (data[i]! < 128) n++
    return n
  })
}

/** "current / total" as shown in the toolbar page box, e.g. "1 / 3". */
export async function pageIndicator(page: Page): Promise<string> {
  const current = await page.getByLabel('Page number').inputValue()
  // textContent, not innerText: the toolbar may be hidden (full screen) but still holds the value.
  const total = ((await page.locator('.page-total').textContent()) ?? '').replace('/', '').trim()
  return `${current} / ${total}`
}

/** Waits until the open book is on screen and accepts input (not just "no Opening… yet"). */
export async function waitReady(page: Page): Promise<void> {
  await expect(page.locator('.reader[data-ready="true"]')).toBeVisible({ timeout: 10_000 })
}

export async function expectPage(page: Page, text: string): Promise<void> {
  await expect.poll(() => pageIndicator(page).catch(() => ''), { timeout: 10_000 }).toBe(text)
  await waitReady(page)
}
