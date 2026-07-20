import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Uncategorized on import (blank Category/Sub-Category) and dated in the
// lease's first month — this is what exercises the reconcile-driven
// auto-categorization: reports classify income purely from category type
// (see CLAUDE.md), so a rent charge reconciled against a transaction that's
// never categorized would show "Paid" in the ledger but stay invisible in
// every report unless reconciling also fixes the category.
const fixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-reconcile-payment.csv', import.meta.url),
)
const moveInFixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-movein-payment.csv', import.meta.url),
)
const splitEditFixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-splitedit-payment.csv', import.meta.url),
)

// Category IDs from migrations/0002_seed_categories.sql — stable across environments.
const RENT_INCOME_ID = '93acc0fa-85cc-4300-8f43-f3755da69e2b'
const SECURITY_DEPOSITS_ID = '11382258-499c-4ef2-806a-ee86f1e7e7cd'
const OWNER_DISTRIBUTIONS_ID = '7ce2eaa8-6672-4274-b957-cd0deabfdb40'

// Picks the reconcile-dropdown option whose text matches both a description
// and a dollar amount (the option label is "<date> — <amount> — <desc> (cat)"),
// returning its value so a specific split line can be selected unambiguously
// when several candidates share a description.
async function pickCandidateValue(
  page: Page,
  description: string,
  amount: string,
) {
  const option = page
    .locator('option', { hasText: description })
    .filter({ hasText: amount })
  const value = await option.getAttribute('value')
  if (!value) {
    throw new Error(`No candidate option for "${description}" ${amount}`)
  }
  return value
}

async function signIn(page: Page) {
  await page.goto('/login')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Email').fill('e2e-test@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

test('reconciling a rent charge to a transaction pays the ledger and flows into the P&L', async ({
  page,
}) => {
  await signIn(page)

  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Import CSV').setInputFiles(fixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 1, skipped 0 duplicates, 1 needs a category.'),
  ).toBeVisible()

  const importedRow = page.locator('tr', { hasText: 'Reconcile E2E Payment' })
  await expect(importedRow.locator('select')).toHaveValue('')

  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  // Due date, not period, to avoid also matching the payment's own posted
  // date (2025-11-05) once the reconcile panel below renders it.
  const novemberChargeRow = page.locator('tr', { hasText: '2025-11-01' })
  await novemberChargeRow.getByRole('button', { name: 'Reconcile' }).click()

  const paymentSelect = page.locator('select', {
    hasText: 'Select a transaction',
  })
  const candidateValue = await page
    .locator('option', { hasText: 'Reconcile E2E Payment' })
    .getAttribute('value')
  if (!candidateValue) {
    throw new Error('Reconcile E2E Payment candidate not found in dropdown')
  }
  await paymentSelect.selectOption(candidateValue)
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(
    novemberChargeRow.getByText('paid', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('2025-11-05 — $2,950.00')).toBeVisible()

  // The reconcile action should have categorized the previously-uncategorized
  // transaction as Rent Income.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await expect(importedRow.locator('select')).toHaveValue(RENT_INCOME_ID)

  // ...which is what makes it show up here: the P&L is driven entirely by
  // category type, not by rent_payments.
  await page.goto('/renewal')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)

  const novemberPnlRow = page.locator('tr', { hasText: '2025-11' })
  await expect(novemberPnlRow.locator('td').nth(1)).toHaveText('$2,950.00')
})

test('a move-in split across two rent lines and a deposit reconciles per line', async ({
  page,
}) => {
  await signIn(page)

  // One $5,900 move-in split into two rent lines ($1,475 prorated + $2,950
  // first full month) plus a $1,475 security deposit. Nothing is booked
  // automatically — each rent line is picked against its own charge, and the
  // deposit (a `transfer`) is never offered as a rent payment at all.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Import CSV').setInputFiles(moveInFixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 1, skipped 0 duplicates, 1 needs a category.'),
  ).toBeVisible()

  const importedRow = page.locator('tr', { hasText: 'Move-In E2E Payment' })
  await importedRow.getByRole('button', { name: 'Split' }).click()
  await page.getByRole('button', { name: 'Add line' }).click()
  const categorySelects = page.locator('select', { hasText: 'Choose category' })
  const amounts = page.locator('input[type=number]')
  await categorySelects.nth(0).selectOption(RENT_INCOME_ID)
  await amounts.nth(0).fill('1475.00')
  await categorySelects.nth(1).selectOption(RENT_INCOME_ID)
  await amounts.nth(1).fill('2950.00')
  await categorySelects.nth(2).selectOption(SECURITY_DEPOSITS_ID)
  await amounts.nth(2).fill('1475.00')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(importedRow.getByText('Rent Income: $1,475.00')).toBeVisible()
  await expect(importedRow.getByText('Rent Income: $2,950.00')).toBeVisible()

  // On /lease, both rent lines are offered as pickable candidates and the
  // deposit is not — exactly two options carry this transaction's name (the
  // deposit, a `transfer`, is never a rent-payment candidate). Asserting on
  // candidates rather than a charge's paid total keeps this independent of
  // other specs' data in the shared local D1.
  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  const decemberChargeRow = page.locator('tr', { hasText: '2025-12-01' })
  await decemberChargeRow.getByRole('button', { name: 'Reconcile' }).click()
  const paymentSelect = page.locator('select', {
    hasText: 'Select a transaction',
  })
  await expect(
    page.locator('option', { hasText: 'Move-In E2E Payment' }),
  ).toHaveCount(2)

  // Assign just the $1,475 prorated line to December, leaving the $2,950 line
  // free for its own month. Assert on the recorded payment line (posted date +
  // amount), which is unique to this transaction, rather than the charge's
  // aggregate paid column.
  await paymentSelect.selectOption(
    await pickCandidateValue(page, 'Move-In E2E Payment', '$1,475.00'),
  )
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('2025-12-05 — $1,475.00')).toBeVisible()
})

test('editing an unrelated split line preserves a manually reconciled payment', async ({
  page,
}) => {
  await signIn(page)

  // $5,900 split into two rent lines ($2,950 + $1,475) and a $1,475 deposit.
  // The $1,475 rent line is reconciled to June, then an *unrelated* split line
  // (the deposit) is edited — a probe of whether that reconciled payment
  // survives the edit rather than being silently dropped.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Import CSV').setInputFiles(splitEditFixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 1, skipped 0 duplicates, 1 needs a category.'),
  ).toBeVisible()

  const importedRow = page.locator('tr', { hasText: 'Split Edit E2E Payment' })
  await importedRow.getByRole('button', { name: 'Split' }).click()
  await page.getByRole('button', { name: 'Add line' }).click()
  let categorySelects = page.locator('select', { hasText: 'Choose category' })
  const amounts = page.locator('input[type=number]')
  await categorySelects.nth(0).selectOption(RENT_INCOME_ID)
  await amounts.nth(0).fill('2950.00')
  await categorySelects.nth(1).selectOption(RENT_INCOME_ID)
  await amounts.nth(1).fill('1475.00')
  await categorySelects.nth(2).selectOption(SECURITY_DEPOSITS_ID)
  await amounts.nth(2).fill('1475.00')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    importedRow.getByText('Security Deposits: $1,475.00'),
  ).toBeVisible()

  // Manually reconcile the $1,475 rent line to June.
  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  const juneChargeRow = page.locator('tr', { hasText: '2026-06-01' })
  await juneChargeRow.getByRole('button', { name: 'Reconcile' }).click()
  const paymentSelect = page.locator('select', {
    hasText: 'Select a transaction',
  })
  await paymentSelect.selectOption(
    await pickCandidateValue(page, 'Split Edit E2E Payment', '$1,475.00'),
  )
  await page.getByRole('button', { name: 'Add' }).click()
  // Assert on this payment's unique line (posted date + amount), not June's
  // aggregate paid column, so shared-DB data from other specs can't skew it.
  await expect(page.getByText('2026-06-05 — $1,475.00')).toBeVisible()

  // Now edit only the *deposit* line — recategorize it, leaving both rent
  // lines untouched. The reconciled rent payment must survive this: it's the
  // same economic line, not a stale link.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await importedRow.getByRole('button', { name: 'Edit split' }).click()
  categorySelects = page.locator('select', { hasText: 'Choose category' })
  await categorySelects.nth(2).selectOption(OWNER_DISTRIBUTIONS_ID)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    importedRow.getByText('Owner Distributions: $1,475.00'),
  ).toBeVisible()

  // Re-open June's reconcile panel: the $1,475 payment line must still be
  // there — preserved across the edit, not silently dropped.
  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await juneChargeRow.getByRole('button', { name: 'Reconcile' }).click()
  await expect(page.getByText('2026-06-05 — $1,475.00')).toBeVisible()
})
