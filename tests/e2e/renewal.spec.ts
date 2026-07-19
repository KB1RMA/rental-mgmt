import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// A dedicated fixture in a month no other spec's fixtures touch, so this
// import can't collide with another spec's dedupe-count assertions and this
// test's own assertions stay independent of execution order.
const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-renewal-transactions.csv', import.meta.url),
)

async function signIn(page: Page) {
  await page.goto('/login')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Email').fill('e2e-test@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

test('renewal dashboard shows monthly P&L and persists an edited projection', async ({
  page,
}) => {
  await signIn(page)

  // Idempotent: dedupes on re-run against an already-seeded local D1.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText(/Imported \d+, skipped \d+ duplicates/),
  ).toBeVisible()

  await page.goto('/renewal')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

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
  // depend on the trailing-actuals average, which varies with other specs'
  // fixture imports and test execution order.
  await page.getByLabel('Expense override ($, optional)').fill('500.00')

  await expect(page.getByText('$2,600.00/mo')).toBeVisible()

  await page.getByLabel('Notes').fill('E2E renewal projection test')
  await page.getByRole('button', { name: 'Save' }).click()

  await page.reload()
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

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
