import { describe, expect, it } from 'vitest'

import {
  computeChargeStatus,
  generateChargePeriods,
  periodForPaymentDate,
} from './ledger'

describe('generateChargePeriods', () => {
  it('generates one charge per month from lease start through the reference date', () => {
    const periods = generateChargePeriods(
      '2025-11-15',
      '2026-11-30',
      1,
      '2026-02-01',
    )
    expect(periods).toEqual([
      { period: '2025-11', dueDate: '2025-11-01' },
      { period: '2025-12', dueDate: '2025-12-01' },
      { period: '2026-01', dueDate: '2026-01-01' },
      { period: '2026-02', dueDate: '2026-02-01' },
    ])
  })

  it('caps at the lease end date when it is earlier than the reference date', () => {
    const periods = generateChargePeriods(
      '2026-01-01',
      '2026-02-28',
      1,
      '2026-06-01',
    )
    expect(periods.map((p) => p.period)).toEqual(['2026-01', '2026-02'])
  })

  it('handles a year boundary', () => {
    const periods = generateChargePeriods(
      '2025-11-15',
      '2026-11-30',
      1,
      '2026-01-15',
    )
    expect(periods.map((p) => p.period)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ])
  })

  it('pads the due date to the configured rent due day', () => {
    const periods = generateChargePeriods(
      '2026-01-01',
      '2026-01-31',
      15,
      '2026-01-31',
    )
    expect(periods).toEqual([{ period: '2026-01', dueDate: '2026-01-15' }])
  })
})

describe('periodForPaymentDate', () => {
  it('takes the year-month of the posted date', () => {
    expect(periodForPaymentDate('2026-04-01')).toBe('2026-04')
    expect(periodForPaymentDate('2026-04-28')).toBe('2026-04')
  })
})

describe('computeChargeStatus', () => {
  it('is paid when the amount is fully covered', () => {
    expect(
      computeChargeStatus(295000, 295000, '2026-04-01', 30, '2026-04-05'),
    ).toBe('paid')
  })

  it('is paid when overpaid', () => {
    expect(
      computeChargeStatus(295000, 300000, '2026-04-01', 30, '2026-04-05'),
    ).toBe('paid')
  })

  it('is due when nothing has been paid and still within the grace window', () => {
    expect(computeChargeStatus(295000, 0, '2026-04-01', 30, '2026-04-05')).toBe(
      'due',
    )
  })

  it('is partial when some but not all has been paid, within the grace window', () => {
    expect(
      computeChargeStatus(295000, 267000, '2026-03-01', 30, '2026-03-05'),
    ).toBe('partial')
  })

  it('is late when nothing has been paid past the grace window', () => {
    expect(computeChargeStatus(295000, 0, '2026-04-01', 30, '2026-06-01')).toBe(
      'late',
    )
  })

  it('is late (not partial) when partially paid but past the grace window', () => {
    expect(
      computeChargeStatus(295000, 100000, '2026-04-01', 30, '2026-06-01'),
    ).toBe('late')
  })

  it('is exactly on the grace boundary — not yet late', () => {
    // due 2026-04-01 + 30 days = 2026-05-01
    expect(computeChargeStatus(295000, 0, '2026-04-01', 30, '2026-05-01')).toBe(
      'due',
    )
  })

  it('is late the day after the grace boundary', () => {
    expect(computeChargeStatus(295000, 0, '2026-04-01', 30, '2026-05-02')).toBe(
      'late',
    )
  })
})
