import { describe, expect, it } from 'vitest'

import { computeProjection } from './projection'

describe('computeProjection', () => {
  it('computes net and margin at the proposed rent for both views', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 50000,
    })

    expect(result.cashFlow.netCents).toBe(100000)
    expect(result.cashFlow.marginPct).toBeCloseTo(100 / 3)
    expect(result.operating).toEqual({
      netCents: 150000,
      marginPct: 50,
    })
  })

  it('computes the comparison figures at the current rent', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 50000,
    })

    expect(result.atCurrentRent.cashFlow.netCents).toBe(95000)
    expect(result.atCurrentRent.operating.netCents).toBe(145000)
  })

  it('computes rent increase amount and percentage', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 0,
    })

    expect(result.rentIncreaseCents).toBe(5000)
    expect(result.rentIncreasePct).toBeCloseTo((5000 / 295000) * 100)
  })

  it('returns a null rent increase percentage when current rent is zero', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 0,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 0,
    })

    expect(result.rentIncreasePct).toBeNull()
  })

  it('computes break-even rent per view', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 50000,
    })

    expect(result.breakEvenRentCents.cashFlow).toBe(200000)
    expect(result.breakEvenRentCents.operating).toBe(150000)
  })

  it('clamps operating expense at zero when principal exceeds total expenses', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 50000,
      monthlyPrincipalCents: 200000,
    })

    expect(result.breakEvenRentCents.operating).toBe(0)
    expect(result.operating.netCents).toBe(300000)
  })

  it('reports null margin when the reference rent is zero', () => {
    const result = computeProjection({
      proposedRentCents: 0,
      currentRentCents: 0,
      monthlyExpenseCents: 100000,
      monthlyPrincipalCents: 0,
    })

    expect(result.cashFlow.marginPct).toBeNull()
    expect(result.operating.marginPct).toBeNull()
  })

  it('annualizes the cash-flow net', () => {
    const result = computeProjection({
      proposedRentCents: 300000,
      currentRentCents: 295000,
      monthlyExpenseCents: 200000,
      monthlyPrincipalCents: 0,
    })

    expect(result.annualCashFlowNetCents).toBe(100000 * 12)
  })
})
