import { describe, expect, it } from 'vitest'

import {
  averageMonthlyExpenseCents,
  computeMonthlyPnl,
  enumerateMonths,
} from './monthly-pnl'
import type { PnlTransaction } from './monthly-pnl'

const income = { type: 'income' as const, scheduleELine: null }
const repairs = { type: 'expense' as const, scheduleELine: 'repairs' }
const mortgage = {
  type: 'expense' as const,
  scheduleELine: 'mortgage_interest',
}
const deposit = { type: 'transfer' as const, scheduleELine: null }
const ignore = { type: 'ignore' as const, scheduleELine: null }
const principal = { type: 'equity' as const, scheduleELine: null }
const escrow = { type: 'expense' as const, scheduleELine: 'taxes' }

function txn(
  postedDate: string,
  amountCents: number,
  category: PnlTransaction['category'],
  splits: PnlTransaction['splits'] = [],
): PnlTransaction {
  return { postedDate, amountCents, category, splits }
}

describe('enumerateMonths', () => {
  it('walks month by month inclusive of both ends', () => {
    expect(enumerateMonths('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('handles a single month', () => {
    expect(enumerateMonths('2026-01', '2026-01')).toEqual(['2026-01'])
  })
})

describe('computeMonthlyPnl', () => {
  it('buckets income and expenses by month and zero-fills gap months', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-10', 50000, repairs),
        // 2025-12 has no transactions at all
        txn('2026-01-05', 295000, income),
      ],
      startPeriod: '2025-11',
      endPeriod: '2026-01',
      monthlyPrincipalCents: 0,
    })

    expect(rows.map((r) => r.period)).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(rows[0]).toMatchObject({
      incomeCents: 295000,
      expenseCents: 50000,
      cashFlowNetCents: 245000,
    })
    expect(rows[1]).toMatchObject({
      incomeCents: 0,
      expenseCents: 0,
      cashFlowNetCents: 0,
      cashFlowMarginPct: null,
    })
    expect(rows[2]).toMatchObject({
      incomeCents: 295000,
      expenseCents: 0,
      cashFlowNetCents: 295000,
    })
  })

  it('uses split categories instead of the parent transaction category', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 500000, deposit, [
          { amountCents: 295000, category: income },
          { amountCents: 205000, category: deposit },
        ]),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].incomeCents).toBe(295000)
  })

  it('excludes transfer and ignore categories from income/expense', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-10', 100000, deposit),
        txn('2025-11-15', 10000, ignore),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].incomeCents).toBe(295000)
    expect(rows[0].expenseCents).toBe(0)
  })

  it('counts null-category line items as uncategorized and excludes them', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-10', 12000, null),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].uncategorizedCount).toBe(1)
    expect(rows[0].expenseCents).toBe(0)
  })

  it('takes the absolute value of amounts regardless of sign', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', -295000, income),
        txn('2025-11-10', -5000, repairs),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].incomeCents).toBe(295000)
    expect(rows[0].expenseCents).toBe(5000)
  })

  it('identifies mortgage line items via scheduleELine and clamps excluded principal to the payment total', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-01', 180000, mortgage),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 250000, // larger than the actual payment
    })

    expect(rows[0].mortgageCents).toBe(180000)
    expect(rows[0].mortgagePaymentCount).toBe(1)
    expect(rows[0].principalExcludedCents).toBe(180000)
    expect(rows[0].operatingExpenseCents).toBe(0)
    expect(rows[0].operatingNetCents).toBe(295000)
  })

  it('excludes nothing in a month with no mortgage payment', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [txn('2025-11-05', 295000, income)],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 100000,
    })

    expect(rows[0].mortgagePaymentCount).toBe(0)
    expect(rows[0].principalExcludedCents).toBe(0)
  })

  it('multiplies the principal estimate by payment count in a two-payment month', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-01', 180000, mortgage),
        txn('2025-11-29', 180000, mortgage),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 50000,
    })

    expect(rows[0].mortgagePaymentCount).toBe(2)
    expect(rows[0].mortgageCents).toBe(360000)
    expect(rows[0].principalExcludedCents).toBe(100000)
  })

  it('uses the real split principal amount instead of the flat estimate when a mortgage payment is split', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-01', 150359, mortgage, [
          { amountCents: 43037, category: principal },
          { amountCents: 53579, category: mortgage },
          { amountCents: 53743, category: escrow },
        ]),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      // flat estimate should be ignored once real split data exists
      monthlyPrincipalCents: 999999,
    })

    expect(rows[0].expenseCents).toBe(150359)
    expect(rows[0].mortgageCents).toBe(53579)
    expect(rows[0].principalExcludedCents).toBe(43037)
    expect(rows[0].operatingExpenseCents).toBe(150359 - 43037)
  })

  it('falls back to the flat principal estimate for an unsplit lump mortgage payment', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-01', 180000, mortgage),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 40000,
    })

    expect(rows[0].expenseCents).toBe(180000)
    expect(rows[0].principalExcludedCents).toBe(40000)
    expect(rows[0].operatingExpenseCents).toBe(140000)
  })

  it('includes an unsplit equity-type transaction in cash flow but excludes it from operating expense', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-10', 50000, principal),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].expenseCents).toBe(50000)
    expect(rows[0].operatingExpenseCents).toBe(0)
    expect(rows[0].principalExcludedCents).toBe(50000)
  })

  it('reports null margin when income is zero', () => {
    const { rows } = computeMonthlyPnl({
      transactions: [txn('2025-11-10', 5000, repairs)],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].cashFlowMarginPct).toBeNull()
    expect(rows[0].operatingMarginPct).toBeNull()
  })

  it('sums totals across the whole range', () => {
    const { totals } = computeMonthlyPnl({
      transactions: [
        txn('2025-11-05', 295000, income),
        txn('2025-11-10', 50000, repairs),
        txn('2025-12-05', 295000, income),
        txn('2025-12-10', 25000, repairs),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-12',
      monthlyPrincipalCents: 0,
    })

    expect(totals.incomeCents).toBe(590000)
    expect(totals.expenseCents).toBe(75000)
    expect(totals.cashFlowNetCents).toBe(515000)
  })

  it('drops line items posted before startPeriod', () => {
    const { rows, totals } = computeMonthlyPnl({
      transactions: [
        txn('2025-10-05', 295000, income), // before window
        txn('2025-11-05', 295000, income),
      ],
      startPeriod: '2025-11',
      endPeriod: '2025-11',
      monthlyPrincipalCents: 0,
    })

    expect(rows[0].incomeCents).toBe(295000)
    expect(totals.incomeCents).toBe(295000)
  })
})

describe('averageMonthlyExpenseCents', () => {
  function rowsWithExpenses(expenses: number[]) {
    return computeMonthlyPnl({
      transactions: expenses.flatMap((cents, i) => {
        const month = String(i + 1).padStart(2, '0')
        return cents > 0 ? [txn(`2025-${month}-10`, cents, repairs)] : []
      }),
      startPeriod: '2025-01',
      endPeriod: `2025-${String(expenses.length).padStart(2, '0')}`,
      monthlyPrincipalCents: 0,
    }).rows
  }

  it('excludes the last (current, partial) month by default', () => {
    const rows = rowsWithExpenses([10000, 20000, 90000])
    // last month (90000) excluded; average of first two
    expect(averageMonthlyExpenseCents(rows)).toBe(15000)
  })

  it('averages over fewer than 12 months when history is short', () => {
    const rows = rowsWithExpenses([10000, 20000])
    expect(averageMonthlyExpenseCents(rows)).toBe(10000)
  })

  it('only considers the trailing window size requested', () => {
    const rows = rowsWithExpenses([
      100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 999999,
    ])
    // last month excluded (999999), trailing 3 of the remaining 12 are all 0
    expect(averageMonthlyExpenseCents(rows, { trailingMonths: 3 })).toBe(0)
  })

  it('returns 0 when there is no eligible history', () => {
    const rows = rowsWithExpenses([50000])
    expect(averageMonthlyExpenseCents(rows)).toBe(0)
  })
})
