import { fileURLToPath } from 'node:url'

import { expect, gotoHydrated, signIn, test } from './fixtures'

const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-tax-assessments.csv', import.meta.url),
)

test('imports a tax-assessment CSV, derives totals, and upserts on re-import', async ({
  page,
}) => {
  await signIn(page)
  await gotoHydrated(page, '/tax-assessments')

  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(page.getByText('Imported 3, updated 0.')).toBeVisible()

  const row2025 = page.locator('tr', { hasText: '2025' })
  await expect(row2025.getByText('$400,000.00')).toBeVisible()
  await expect(row2025.getByText('$3,800.00')).toBeVisible()

  const row2023 = page.locator('tr', { hasText: '2023' })
  await expect(row2023.getByText('$345,000.00')).toBeVisible()
  await expect(row2023.getByText('$3,519.00')).toBeVisible()

  // Re-import the same file: same fiscal years should now upsert, not duplicate.
  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText('Imported 0, updated 3.')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(3)
})

test('manual entry derives total and annual tax when left blank', async ({
  page,
}) => {
  await signIn(page)
  await gotoHydrated(page, '/tax-assessments')

  await page.getByLabel('Fiscal year').fill('2020')
  await page.getByLabel('Land ($)').fill('50000')
  await page.getByLabel('Building ($)').fill('150000')
  await page.getByLabel('Tax rate ($/1,000)').fill('10.00')
  await page.getByRole('button', { name: 'Save' }).click()

  const row = page.locator('tr', { hasText: '2020' })
  await expect(row.getByText('$200,000.00')).toBeVisible()
  await expect(row.getByText('$2,000.00')).toBeVisible()
})

test('deleting an assessment removes it from the table', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/tax-assessments')

  await page.getByLabel('Fiscal year').fill('2019')
  await page.getByLabel('Land ($)').fill('10000')
  await page.getByLabel('Building ($)').fill('20000')
  await page.getByLabel('Tax rate ($/1,000)').fill('12.00')
  await page.getByRole('button', { name: 'Save' }).click()

  const row = page.locator('tr', { hasText: '2019' })
  await expect(row).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).not.toBeVisible()
})
