import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-transactions.csv', import.meta.url),
)
const bankStatementFixturePath = fileURLToPath(
  new URL('../fixtures/sample-bank-statement.csv', import.meta.url),
)

// Category IDs from migrations/0002_seed_categories.sql — stable across environments.
const RENT_INCOME_ID = '93acc0fa-85cc-4300-8f43-f3755da69e2b'
const REPAIRS_ID = '9f30bd5a-acac-4e4c-a3cb-cf781a8845b2'
const OTHER_EXPENSES_ID = '62046bd7-c4f1-4008-a65f-575dc6b398bc'
const MORTGAGE_INTEREST_ID = 'a4ba3ac4-483e-4bfe-9c5f-f98d24e37173'

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
