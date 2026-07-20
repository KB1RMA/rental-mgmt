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
const autoSplitFixtureCsvPath = fileURLToPath(
  new URL('../fixtures/sample-autosplit-payment.csv', import.meta.url),
)

// Category IDs from migrations/0002_seed_categories.sql — stable across environments.
const RENT_INCOME_ID = '93acc0fa-85cc-4300-8f43-f3755da69e2b'
const SECURITY_DEPOSITS_ID = '11382258-499c-4ef2-806a-ee86f1e7e7cd'

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

test('splitting an already auto-matched transaction replaces the stale whole-transaction payment', async ({
  page,
}) => {
  await signIn(page)

  // Imported already categorized Rent Income (Category=Income/Rents), so
  // visiting /lease auto-matches the whole $4,425 to the 2026-01 charge —
  // before anyone notices it was really a combined rent + deposit payment.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Import CSV').setInputFiles(autoSplitFixtureCsvPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(
    page.getByText('Imported 1, skipped 0 duplicates, 0 need a category.'),
  ).toBeVisible()

  const importedRow = page.locator('tr', { hasText: 'Auto Match E2E Payment' })
  await expect(importedRow.locator('select')).toHaveValue(RENT_INCOME_ID)

  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  const januaryChargeRow = page.locator('tr', { hasText: '2026-01-01' })
  await expect(januaryChargeRow.getByText('$4,425.00')).toBeVisible()

  // Correct the mistake: only $1,475 of the $4,425 was actually rent.
  await page.goto('/transactions')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await importedRow.getByRole('button', { name: 'Split' }).click()
  const categorySelects = page.locator('select', { hasText: 'Choose category' })
  await categorySelects.nth(0).selectOption(RENT_INCOME_ID)
  await page.locator('input[type=number]').nth(0).fill('1475.00')
  await categorySelects.nth(1).selectOption(SECURITY_DEPOSITS_ID)
  await page.locator('input[type=number]').nth(1).fill('2950.00')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(importedRow.getByText('Rent Income: $1,475.00')).toBeVisible()

  // Revisiting /lease re-runs the auto-sync. The old $4,425 whole-transaction
  // payment must be gone (its "whole transaction" view no longer exists once
  // split) and replaced by a fresh match on just the $1,475 Rent Income
  // split — never both, which would double-count the same money.
  await page.goto('/lease')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await expect(januaryChargeRow.getByText('$1,475.00')).toBeVisible()
  await expect(januaryChargeRow.getByText('$4,425.00')).not.toBeVisible()
})
