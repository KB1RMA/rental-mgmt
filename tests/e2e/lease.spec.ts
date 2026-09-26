import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { expect, gotoHydrated, signIn, test } from './fixtures'

const fixtureDocPath = fileURLToPath(
  new URL('../fixtures/sample-document.txt', import.meta.url),
)

test('lease page shows seeded terms and renewal deadline', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/lease')

  await expect(
    page.getByRole('heading', { name: 'Example Property' }),
  ).toBeVisible()
  await expect(page.getByText('Jordan Tenant')).toBeVisible()
  await expect(page.getByText('$2,950.00').first()).toBeVisible()
  await expect(page.getByText('2026-10-01')).toBeVisible()
})

test('uploads a document and downloads it back byte-identical', async ({
  page,
}) => {
  await signIn(page)
  await gotoHydrated(page, '/lease')

  await page.getByLabel('File').setInputFiles(fixtureDocPath)
  await page.getByRole('button', { name: 'Upload' }).click()

  const downloadLink = page.getByRole('link', { name: 'sample-document.txt' })
  await expect(downloadLink).toHaveCount(1)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLink.click(),
  ])
  const downloadedPath = await download.path()

  const original = readFileSync(fixtureDocPath)
  const downloaded = readFileSync(downloadedPath)
  expect(createHash('sha256').update(downloaded).digest('hex')).toBe(
    createHash('sha256').update(original).digest('hex'),
  )
})
