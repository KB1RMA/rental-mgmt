export interface PnlCategory {
  type: 'income' | 'expense' | 'transfer' | 'ignore' | 'equity'
  scheduleELine: string | null
}

export interface PnlTransaction {
  postedDate: string
  amountCents: number
  category: PnlCategory | null
  splits: Array<{ amountCents: number; category: PnlCategory }>
}

export interface MonthlyPnlRow {
  period: string
  incomeCents: number
  expenseCents: number
  mortgageCents: number
  mortgagePaymentCount: number
  principalExcludedCents: number
  cashFlowNetCents: number
  cashFlowMarginPct: number | null
  operatingExpenseCents: number
  operatingNetCents: number
  operatingMarginPct: number | null
  uncategorizedCount: number
}

export type PnlTotals = Omit<MonthlyPnlRow, 'period'>

export interface PnlSummary {
  rows: MonthlyPnlRow[]
  totals: PnlTotals
}

/** Every calendar month from `startPeriod` through `endPeriod`, inclusive. */
export function enumerateMonths(
  startPeriod: string,
  endPeriod: string,
): string[] {
  const periods: string[] = []

  let year = Number(startPeriod.slice(0, 4))
  let month = Number(startPeriod.slice(5, 7))
  const lastYear = Number(endPeriod.slice(0, 4))
  const lastMonth = Number(endPeriod.slice(5, 7))

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return periods
}

function marginPct(netCents: number, incomeCents: number): number | null {
  if (incomeCents === 0) return null
  return (netCents / incomeCents) * 100
}

interface LineItem {
  postedDate: string
  amountCents: number
  category: PnlCategory
}

function expandLineItems(transactions: PnlTransaction[]): {
  items: LineItem[]
  uncategorizedByPeriod: Map<string, number>
} {
  const items: LineItem[] = []
  const uncategorizedByPeriod = new Map<string, number>()

  for (const txn of transactions) {
    const period = txn.postedDate.slice(0, 7)
    const parts =
      txn.splits.length > 0
        ? txn.splits.map((s) => ({
            amountCents: s.amountCents,
            category: s.category,
          }))
        : [{ amountCents: txn.amountCents, category: txn.category }]

    for (const part of parts) {
      if (part.category == null) {
        uncategorizedByPeriod.set(
          period,
          (uncategorizedByPeriod.get(period) ?? 0) + 1,
        )
        continue
      }
      if (part.category.type === 'transfer' || part.category.type === 'ignore')
        continue
      items.push({
        postedDate: txn.postedDate,
        amountCents: part.amountCents,
        category: part.category,
      })
    }
  }

  return { items, uncategorizedByPeriod }
}

function emptyTotals(): PnlTotals {
  return {
    incomeCents: 0,
    expenseCents: 0,
    mortgageCents: 0,
    mortgagePaymentCount: 0,
    principalExcludedCents: 0,
    cashFlowNetCents: 0,
    cashFlowMarginPct: null,
    operatingExpenseCents: 0,
    operatingNetCents: 0,
    operatingMarginPct: null,
    uncategorizedCount: 0,
  }
}

export function computeMonthlyPnl(input: {
  transactions: PnlTransaction[]
  startPeriod: string
  endPeriod: string
  monthlyPrincipalCents: number
}): PnlSummary {
  const { transactions, startPeriod, endPeriod, monthlyPrincipalCents } = input
  const periods = enumerateMonths(startPeriod, endPeriod)
  const { items, uncategorizedByPeriod } = expandLineItems(transactions)

  const byPeriod = new Map<
    string,
    {
      incomeCents: number
      expenseCents: number
      equityCents: number
      mortgage: LineItem[]
    }
  >()
  for (const period of periods) {
    byPeriod.set(period, {
      incomeCents: 0,
      expenseCents: 0,
      equityCents: 0,
      mortgage: [],
    })
  }

  for (const item of items) {
    const period = item.postedDate.slice(0, 7)
    if (period < startPeriod) continue
    const bucket = byPeriod.get(period)
    if (!bucket) continue

    const magnitude = Math.abs(item.amountCents)
    if (item.category.type === 'income') {
      bucket.incomeCents += magnitude
    } else if (item.category.type === 'expense') {
      bucket.expenseCents += magnitude
      if (item.category.scheduleELine === 'mortgage_interest') {
        bucket.mortgage.push(item)
      }
    } else if (item.category.type === 'equity') {
      bucket.equityCents += magnitude
    }
  }

  const rows: MonthlyPnlRow[] = periods.map((period) => {
    const bucket = byPeriod.get(period)!
    const mortgageCents = bucket.mortgage.reduce(
      (sum, m) => sum + Math.abs(m.amountCents),
      0,
    )
    const mortgagePaymentCount = bucket.mortgage.length
    const principalExcludedCents =
      bucket.equityCents > 0
        ? bucket.equityCents
        : Math.min(monthlyPrincipalCents * mortgagePaymentCount, mortgageCents)

    const expenseCents = bucket.expenseCents + bucket.equityCents
    const cashFlowNetCents = bucket.incomeCents - expenseCents
    const operatingExpenseCents = expenseCents - principalExcludedCents
    const operatingNetCents = bucket.incomeCents - operatingExpenseCents

    return {
      period,
      incomeCents: bucket.incomeCents,
      expenseCents,
      mortgageCents,
      mortgagePaymentCount,
      principalExcludedCents,
      cashFlowNetCents,
      cashFlowMarginPct: marginPct(cashFlowNetCents, bucket.incomeCents),
      operatingExpenseCents,
      operatingNetCents,
      operatingMarginPct: marginPct(operatingNetCents, bucket.incomeCents),
      uncategorizedCount: uncategorizedByPeriod.get(period) ?? 0,
    }
  })

  const totals = rows.reduce<PnlTotals>((acc, row) => {
    acc.incomeCents += row.incomeCents
    acc.expenseCents += row.expenseCents
    acc.mortgageCents += row.mortgageCents
    acc.mortgagePaymentCount += row.mortgagePaymentCount
    acc.principalExcludedCents += row.principalExcludedCents
    acc.cashFlowNetCents += row.cashFlowNetCents
    acc.operatingExpenseCents += row.operatingExpenseCents
    acc.operatingNetCents += row.operatingNetCents
    acc.uncategorizedCount += row.uncategorizedCount
    return acc
  }, emptyTotals())
  totals.cashFlowMarginPct = marginPct(
    totals.cashFlowNetCents,
    totals.incomeCents,
  )
  totals.operatingMarginPct = marginPct(
    totals.operatingNetCents,
    totals.incomeCents,
  )

  return { rows, totals }
}

/**
 * Average monthly cash-flow expense over the trailing window, used to seed
 * the renewal projection. Excludes the current in-progress month by default
 * so a mid-month snapshot doesn't drag the average down.
 */
export function averageMonthlyExpenseCents(
  rows: MonthlyPnlRow[],
  opts?: { trailingMonths?: number; excludeLastPartialMonth?: boolean },
): number {
  const trailingMonths = opts?.trailingMonths ?? 12
  const excludeLastPartialMonth = opts?.excludeLastPartialMonth ?? true

  const eligible = excludeLastPartialMonth ? rows.slice(0, -1) : rows
  const window = eligible.slice(-trailingMonths)
  if (window.length === 0) return 0

  const total = window.reduce((sum, row) => sum + row.expenseCents, 0)
  return Math.round(total / window.length)
}
