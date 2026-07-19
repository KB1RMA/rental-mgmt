import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'
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

async function signIn(page: Page) {
  await page.goto('/login')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Email').fill('e2e-test@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

test('imports a CSV, maps categories, and dedupes on re-import', async ({
  page,
}) => {
  await signIn(page)
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(
    page.getByText('Imported 6, skipped 0 duplicates, 1 needs a category.'),
  ).toBeVisible()

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

test('manually recategorizing a transaction persists after reload', async ({
  page,
}) => {
  await signIn(page)
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  const mysteryRow = page.locator('tr', { hasText: 'Mystery Fee Example' })
  await mysteryRow.locator('select').selectOption(REPAIRS_ID)

  await page.reload()
  await expect(
    page.locator('tr', { hasText: 'Mystery Fee Example' }).locator('select'),
  ).toHaveValue(REPAIRS_ID)
})

test('imports a bank statement export and applies the rules engine', async ({
  page,
}) => {
  await signIn(page)
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  await page.getByLabel('Source').selectOption('bank-statement')
  await page.getByLabel('Import CSV').setInputFiles(bankStatementFixturePath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(
    page.getByText('Imported 5, skipped 0 duplicates, 2 need a category.'),
  ).toBeVisible()

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
  await signIn(page)
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  await page.getByLabel('Source').selectOption('bank-statement')
  await page.getByLabel('Import CSV').setInputFiles(moveInPaymentFixturePath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByText(/Imported 1,/)).toBeVisible()

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

  await page.getByText('Add line').click()
  const categorySelectsAfterAdd = page.locator('select', {
    hasText: 'Choose category',
  })
  await categorySelectsAfterAdd.nth(2).selectOption(SECURITY_DEPOSITS_ID)
  await page.locator('input[type=number]').nth(2).fill('2950.00')

  await page.getByRole('button', { name: 'Save' }).click()

  const savedRow = page.locator('tr', { hasText: '$7,375.00' })
  await expect(savedRow.getByText('Rent Income: $1,475.00')).toBeVisible()
  await expect(savedRow.getByText('Rent Income: $2,950.00')).toBeVisible()
  await expect(savedRow.getByText('Security Deposits: $2,950.00')).toBeVisible()

  await page.reload()
  const reloadedRow = page.locator('tr', { hasText: '$7,375.00' })
  await expect(
    reloadedRow.getByText('Security Deposits: $2,950.00'),
  ).toBeVisible()
})

test('deleting a transaction removes it from the table', async ({ page }) => {
  await signIn(page)
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  // Relies on the "Mystery Fee Example" transaction imported by an earlier
  // test in this file (tests in this spec run sequentially and share state).
  const row = page.locator('tr', { hasText: 'Mystery Fee Example' })
  await expect(row).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).not.toBeVisible()

  await page.reload()
  await expect(
    page.locator('tr', { hasText: 'Mystery Fee Example' }),
  ).not.toBeVisible()
})
