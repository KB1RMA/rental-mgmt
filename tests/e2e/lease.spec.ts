import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const leasePdfPath = fileURLToPath(
  new URL(
    '../../_docs/Standard Residential Lease (Fixed Term) (MAR 401) (version 4).pdf',
    import.meta.url,
  ),
)

async function signUp(page: Page) {
  const email = `lease-e2e-${Date.now()}@example.com`
  await page.goto('/signup')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Name').fill('Lease E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
}

test('lease page shows seeded terms and renewal deadline', async ({ page }) => {
  await signUp(page)
  await page.goto('/lease')

  await expect(
    page.getByRole('heading', { name: '123 Example Street' }),
  ).toBeVisible()
  await expect(page.getByText('Jordan Tenant')).toBeVisible()
  await expect(page.getByText('$2,950.00').first()).toBeVisible()
  await expect(page.getByText('2026-10-01')).toBeVisible()
})

test('uploads the real lease PDF and downloads it back byte-identical', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  const documentCountBefore = await page
    .getByRole('link', { name: /Standard Residential Lease/ })
    .count()

  await page.getByLabel('File').setInputFiles(leasePdfPath)
  await page.getByRole('button', { name: 'Upload' }).click()

  const downloadLink = page
    .getByRole('link', { name: /Standard Residential Lease/ })
    .last()
  await expect(
    page.getByRole('link', { name: /Standard Residential Lease/ }),
  ).toHaveCount(documentCountBefore + 1)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLink.click(),
  ])
  const downloadedPath = await download.path()

  const original = readFileSync(leasePdfPath)
  const downloaded = readFileSync(downloadedPath)
  expect(createHash('sha256').update(downloaded).digest('hex')).toBe(
    createHash('sha256').update(original).digest('hex'),
  )
})
