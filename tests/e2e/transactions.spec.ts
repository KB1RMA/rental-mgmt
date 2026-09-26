import { fileURLToPath } from 'node:url'

import {
  expect,
  gotoHydrated,
  reloadHydrated,
  signIn,
  test,
  withServerFnWrite,
} from './fixtures'
import type { Page } from '@playwright/test'

const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-transactions.csv', import.meta.url),
)
const bankStatementFixturePath = fileURLToPath(
  new URL('../fixtures/sample-bank-statement.csv', import.meta.url),
)
const moveInPaymentFixturePath = fileURLToPath(
  new URL('../fixtures/sample-move-in-payment.csv', import.meta.url),
)

// Category IDs from migrations/0002_seed_categories.sql — stable across environments.
const RENT_INCOME_ID = '93acc0fa-85cc-4300-8f43-f3755da69e2b'
const REPAIRS_ID = '9f30bd5a-acac-4e4c-a3cb-cf781a8845b2'
const OTHER_EXPENSES_ID = '62046bd7-c4f1-4008-a65f-575dc6b398bc'
const MORTGAGE_INTEREST_ID = 'a4ba3ac4-483e-4bfe-9c5f-f98d24e37173'
const SECURITY_DEPOSITS_ID = '11382258-499c-4ef2-806a-ee86f1e7e7cd'

// Every test starts from an empty transactions table (see fixtures.ts), so
// each one imports exactly the data it needs rather than relying on what an
// earlier test in this file left behind.
async function importCsv(
  page: Page,
  csvPath: string,
  format: 'property-manager' | 'bank-statement',
  expectedSummary: string,
) {
  await gotoHydrated(page, '/transactions')
  await page.getByLabel('Source').selectOption(format)
  await page.getByLabel('Import CSV').setInputFiles(csvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText(expectedSummary)).toBeVisible()
}

function importPropertyManagerFixture(page: Page) {
  return importCsv(
    page,
    fixtureCsvPath,
    'property-manager',
    'Imported 6, skipped 0 duplicates, 1 needs a category.',
  )
}

function importMoveInPayment(page: Page) {
  return importCsv(
    page,
    moveInPaymentFixturePath,
    'bank-statement',
    'Imported 1, skipped 0 duplicates, 1 needs a category.',
  )
}

async function splitMoveInPayment(page: Page) {
  const row = page.locator('tr', { hasText: '$7,375.00' })
  await row.getByRole('button', { name: 'Split' }).click()
  await page.getByRole('button', { name: 'Add line' }).click()
  const categorySelects = page.locator('select', { hasText: 'Choose category' })
  const amounts = page.locator('input[type=number]')
  await categorySelects.nth(0).selectOption(RENT_INCOME_ID)
  await amounts.nth(0).fill('1475.00')
  await categorySelects.nth(1).selectOption(RENT_INCOME_ID)
  await amounts.nth(1).fill('2950.00')
  await categorySelects.nth(2).selectOption(SECURITY_DEPOSITS_ID)
  await amounts.nth(2).fill('2950.00')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Security Deposits: $2,950.00')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('imports a CSV, maps categories, and dedupes on re-import', async ({
  page,
}) => {
  await importPropertyManagerFixture(page)

  const rentRow = page.locator('tr', { hasText: 'Remote Deposit' })
  await expect(rentRow.locator('select')).toHaveValue(RENT_INCOME_ID)

  const feeRow = page.locator('tr', { hasText: 'Ici Fee Example' })
  await expect(feeRow.locator('select')).toHaveValue(OTHER_EXPENSES_ID)

  const mysteryRow = page.locator('tr', { hasText: 'Mystery Fee Example' })
  await expect(mysteryRow.locator('select')).toHaveValue('')

  // Re-import the same file: everything should now be a duplicate.
  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 0, skipped 6 duplicates, 0 need a category.'),
  ).toBeVisible()
})

test('filters the transaction list by category', async ({ page }) => {
  await importPropertyManagerFixture(page)

  const rentRow = page.locator('tr', { hasText: 'Remote Deposit' })
  const repairsRow = page.locator('tr', { hasText: '-$189.34' })
  const feeRow = page.locator('tr', { hasText: 'Ici Fee Example' })
  const mysteryRow = page.locator('tr', { hasText: 'Mystery Fee Example' })

  await expect(rentRow).toBeVisible()
  await expect(repairsRow).toBeVisible()
  await expect(feeRow).toBeVisible()

  await page.getByLabel('Filter by category').selectOption(REPAIRS_ID)

  await expect(repairsRow).toBeVisible()
  await expect(rentRow).not.toBeVisible()
  await expect(feeRow).not.toBeVisible()

  // The filter is reflected in the URL, so it survives a reload.
  await expect(page).toHaveURL(new RegExp(`category=${REPAIRS_ID}`))
  await reloadHydrated(page)
  await expect(page.getByLabel('Filter by category')).toHaveValue(REPAIRS_ID)
  await expect(repairsRow).toBeVisible()
  await expect(rentRow).not.toBeVisible()

  // "Uncategorized" surfaces transactions with no category and no splits.
  await page.getByLabel('Filter by category').selectOption('uncategorized')
  await expect(mysteryRow).toBeVisible()
  await expect(rentRow).not.toBeVisible()
  await expect(repairsRow).not.toBeVisible()

  await page.getByLabel('Filter by category').selectOption('')
  await expect(page).not.toHaveURL(/category=/)

  await expect(rentRow).toBeVisible()
  await expect(repairsRow).toBeVisible()
  await expect(feeRow).toBeVisible()
  await expect(mysteryRow).toBeVisible()
})

test('manually recategorizing a transaction persists after reload', async ({
  page,
}) => {
  await importPropertyManagerFixture(page)

  const mysterySelect = page
    .locator('tr', { hasText: 'Mystery Fee Example' })
    .locator('select')
  await withServerFnWrite(page, () => mysterySelect.selectOption(REPAIRS_ID))
  await expect(mysterySelect).toHaveValue(REPAIRS_ID)

  await reloadHydrated(page)
  await expect(mysterySelect).toHaveValue(REPAIRS_ID)
})

test('imports a bank statement export and applies the rules engine', async ({
  page,
}) => {
  await importCsv(
    page,
    bankStatementFixturePath,
    'bank-statement',
    'Imported 5, skipped 0 duplicates, 2 need a category.',
  )

  const rentRow = page.locator('tr', { hasText: 'Remote Deposit' })
  await expect(rentRow.locator('select')).toHaveValue(RENT_INCOME_ID)

  const mortgageRow = page.locator('tr', { hasText: 'WF HOME MTG' })
  await expect(mortgageRow.locator('select')).toHaveValue(MORTGAGE_INTEREST_ID)

  const feeRow = page.locator('tr', { hasText: 'ICI*FEE' })
  await expect(feeRow.locator('select')).toHaveValue(OTHER_EXPENSES_ID)

  const checkRow = page.locator('tr', { hasText: '-$201.50' })
  await expect(checkRow.locator('select')).toHaveValue('')

  const atmRow = page.locator('tr', { hasText: 'ATM Withdrawal' })
  await expect(atmRow.locator('select')).toHaveValue('')
})

test('splits a lump-sum payment into multiple categories', async ({ page }) => {
  await importMoveInPayment(page)

  const row = page.locator('tr', { hasText: '$7,375.00' })
  await row.getByRole('button', { name: 'Split' }).click()

  const categorySelects = page.locator('select', { hasText: 'Choose category' })
  await categorySelects.nth(0).selectOption(RENT_INCOME_ID)
  await page.locator('input[type=number]').nth(0).fill('1475.00')
  await categorySelects.nth(1).selectOption(RENT_INCOME_ID)
  await page.locator('input[type=number]').nth(1).fill('2950.00')

  // Totals don't match yet ($4,425 of $7,375) — Save should refuse.
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/Lines total/)).toBeVisible()

  await page.getByRole('button', { name: 'Add line' }).click()
  await categorySelects.nth(2).selectOption(SECURITY_DEPOSITS_ID)
  await page.locator('input[type=number]').nth(2).fill('2950.00')

  await page.getByRole('button', { name: 'Save' }).click()

  await expect(row.getByText('Rent Income: $1,475.00')).toBeVisible()
  await expect(row.getByText('Rent Income: $2,950.00')).toBeVisible()
  await expect(row.getByText('Security Deposits: $2,950.00')).toBeVisible()

  await reloadHydrated(page)
  await expect(row.getByText('Security Deposits: $2,950.00')).toBeVisible()
})

test('filters a split transaction by any of its split categories', async ({
  page,
}) => {
  await importMoveInPayment(page)
  await splitMoveInPayment(page)

  const splitRow = page.locator('tr', { hasText: '$7,375.00' })

  await page.getByLabel('Filter by category').selectOption(SECURITY_DEPOSITS_ID)
  await expect(splitRow).toBeVisible()

  await page.getByLabel('Filter by category').selectOption(RENT_INCOME_ID)
  await expect(splitRow).toBeVisible()

  await page.getByLabel('Filter by category').selectOption(MORTGAGE_INTEREST_ID)
  await expect(splitRow).not.toBeVisible()
})

test('filtering excludes a transaction once it is split into categories that no longer include its original one', async ({
  page,
}) => {
  await importPropertyManagerFixture(page)

  // Auto-categorized as Rent Income on import, before any split existed.
  const row = page.locator('tr', { hasText: 'Remote Deposit' })
  await expect(row.locator('select')).toHaveValue(RENT_INCOME_ID)

  await row.getByRole('button', { name: 'Split' }).click()
  const categorySelects = page.locator('select', { hasText: 'Choose category' })
  await categorySelects.nth(0).selectOption(REPAIRS_ID)
  await page.locator('input[type=number]').nth(0).fill('1000.00')
  await categorySelects.nth(1).selectOption(OTHER_EXPENSES_ID)
  await page.locator('input[type=number]').nth(1).fill('1950.00')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(row.getByText('Repairs: $1,000.00')).toBeVisible()

  // Rent Income is the transaction's stale original category — none of its
  // money is categorized that way anymore, so the filter must not match it.
  await page.getByLabel('Filter by category').selectOption(RENT_INCOME_ID)
  await expect(row).not.toBeVisible()

  await page.getByLabel('Filter by category').selectOption(REPAIRS_ID)
  await expect(row).toBeVisible()

  await page.getByLabel('Filter by category').selectOption(OTHER_EXPENSES_ID)
  await expect(row).toBeVisible()
})

test('deleting a transaction removes it from the table', async ({ page }) => {
  await importPropertyManagerFixture(page)

  const row = page.locator('tr', { hasText: 'Mystery Fee Example' })
  await expect(row).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).not.toBeVisible()

  await reloadHydrated(page)
  await expect(row).not.toBeVisible()
})
