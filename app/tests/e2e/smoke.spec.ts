import { expect, test, type ElectronApplication } from '@playwright/test'
import { launch } from './helpers'
import type { Api } from '../../src/shared/ipc'

let app: ElectronApplication

test.beforeAll(async () => {
  ;({ app } = await launch()) // own empty data folder, never the user's real library
})

test.afterAll(async () => {
  await app.close()
})

test('starts on the empty library', async () => {
  const page = await app.firstWindow()
  await expect(page.getByText('No books yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open book…' })).toBeVisible()
})

test('renderer has the bridge but no Node access', async () => {
  const page = await app.firstWindow()
  const result = await page.evaluate(async () => ({
    theme: await (globalThis as unknown as { api: Api }).api.app.systemTheme(),
    hasRequire: typeof (globalThis as { require?: unknown }).require !== 'undefined',
    hasProcess: typeof (globalThis as { process?: unknown }).process !== 'undefined'
  }))
  expect(['day', 'night']).toContain(result.theme)
  expect(result.hasRequire).toBe(false)
  expect(result.hasProcess).toBe(false)
})

test('network requests to the internet are blocked', async () => {
  const page = await app.firstWindow()
  const outcome = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/')
      return 'loaded'
    } catch {
      return 'blocked'
    }
  })
  expect(outcome).toBe('blocked')
})
