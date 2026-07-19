export interface ChargePeriod {
  period: string
  dueDate: string
}

/**
 * One charge per calendar month from the lease's start month through the
 * earlier of the lease end or `throughDate`, due on `rentDueDay`.
 */
export function generateChargePeriods(
  startDate: string,
  endDate: string,
  rentDueDay: number,
  throughDate: string,
): ChargePeriod[] {
  const lastPeriod = endDate < throughDate ? endDate : throughDate
  const periods: ChargePeriod[] = []

  let year = Number(startDate.slice(0, 4))
  let month = Number(startDate.slice(5, 7))
  const lastYear = Number(lastPeriod.slice(0, 4))
  const lastMonth = Number(lastPeriod.slice(5, 7))

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const mm = String(month).padStart(2, '0')
    const dd = String(rentDueDay).padStart(2, '0')
    periods.push({ period: `${year}-${mm}`, dueDate: `${year}-${mm}-${dd}` })

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return periods
}

/** A payment posted in a given month is assumed to cover that month's rent. */
export function periodForPaymentDate(postedDate: string): string {
  return postedDate.slice(0, 7)
}

export type ChargeStatus = 'due' | 'partial' | 'paid' | 'late'

export function computeChargeStatus(
  amountCents: number,
  paidCents: number,
  dueDate: string,
  graceDays: number,
  asOfDate: string,
): ChargeStatus {
  if (paidCents >= amountCents) return 'paid'

  const due = new Date(`${dueDate}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + graceDays)
  const isPastGrace = asOfDate > due.toISOString().slice(0, 10)

  if (paidCents > 0) return isPastGrace ? 'late' : 'partial'
  return isPastGrace ? 'late' : 'due'
}
