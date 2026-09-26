import { fileURLToPath } from 'node:url'

import {
  expect,
  gotoHydrated,
  reloadHydrated,
  withServerFnWrite,
  signIn,
  test,
} from './fixtures'

const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-renewal-transactions.csv', import.meta.url),
)

test('renewal dashboard shows monthly P&L and persists an edited projection', async ({
  page,
}) => {
  await signIn(page)

  await gotoHydrated(page, '/transactions')
  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 2, skipped 0 duplicates, 0 need a category.'),
  ).toBeVisible()

  await gotoHydrated(page, '/renewal')

  await expect(
    page.getByRole('heading', { name: 'Renewal dashboard' }),
  ).toBeVisible()

  const decemberRow = page.locator('tr', { hasText: '2025-12' })
  await expect(decemberRow.getByText('$2,950.00')).toBeVisible()
  await expect(decemberRow.getByText('$189.34')).toBeVisible()
  await expect(decemberRow.getByText('$2,760.66')).toBeVisible()

  await expect(page.getByTestId('pnl-chart')).toBeAttached()

  await page.getByLabel('Proposed rent ($)').fill('3100.00')
  await page.getByLabel('Monthly principal est. ($)').fill('500.00')
  // Fix the expense assumption explicitly so the projected net below doesn't
  // depend on the trailing-actuals average of whatever this test imported.
  await page.getByLabel('Expense override ($, optional)').fill('500.00')

  await expect(page.getByText('$2,600.00/mo')).toBeVisible()

  await page.getByLabel('Notes').fill('E2E renewal projection test')
  await withServerFnWrite(page, () =>
    page.getByRole('button', { name: 'Save' }).click(),
  )

  await reloadHydrated(page)

  await expect(page.getByLabel('Proposed rent ($)')).toHaveValue('3100.00')
  await expect(page.getByLabel('Monthly principal est. ($)')).toHaveValue(
    '500.00',
  )
  await expect(page.getByLabel('Expense override ($, optional)')).toHaveValue(
    '500.00',
  )
  await expect(page.getByLabel('Notes')).toHaveValue(
    'E2E renewal projection test',
  )
})
