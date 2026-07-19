import { describe, expect, it } from 'vitest'

import { matchCategorizationRule } from './engine'
import type { CategorizationRule } from './engine'

function rule(overrides: Partial<CategorizationRule>): CategorizationRule {
  return {
    priority: 1,
    field: 'description',
    matchType: 'contains',
    pattern: '',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId: 'cat-default',
    active: true,
    ...overrides,
  }
}

describe('matchCategorizationRule', () => {
  it('matches a contains rule case-insensitively', () => {
    const result = matchCategorizationRule(
      [rule({ pattern: 'atm withdrawal', categoryId: 'cat-cash' })],
      { description: 'ATM Withdrawal SAMPLETOWN BANK', amountCents: -10000 },
    )
    expect(result).toBe('cat-cash')
  })

  it('returns null when nothing matches', () => {
    const result = matchCategorizationRule(
      [rule({ pattern: 'zzz-no-match' })],
      { description: 'Remote Deposit', amountCents: 295000 },
    )
    expect(result).toBeNull()
  })

  it('respects priority order, lowest number first', () => {
    const rules = [
      rule({ priority: 10, pattern: 'fee', categoryId: 'cat-low-priority' }),
      rule({ priority: 1, pattern: 'fee', categoryId: 'cat-high-priority' }),
    ]
    const result = matchCategorizationRule(rules, {
      description: 'ICI*FEE SAMPLETOWN',
      amountCents: -904,
    })
    expect(result).toBe('cat-high-priority')
  })

  it('skips inactive rules', () => {
    const rules = [
      rule({ pattern: 'fee', active: false, categoryId: 'cat-inactive' }),
    ]
    const result = matchCategorizationRule(rules, {
      description: 'ICI*FEE',
      amountCents: -904,
    })
    expect(result).toBeNull()
  })

  it('enforces amount bounds', () => {
    const rules = [
      rule({
        pattern: 'wells fargo',
        amountMinCents: -160000,
        amountMaxCents: -140000,
        categoryId: 'cat-mortgage',
      }),
    ]
    expect(
      matchCategorizationRule(rules, {
        description: 'Wells Fargo Mortgage',
        amountCents: -150359,
      }),
    ).toBe('cat-mortgage')
    expect(
      matchCategorizationRule(rules, {
        description: 'Wells Fargo Mortgage',
        amountCents: -50,
      }),
    ).toBeNull()
  })

  it('matches against merchant field when field is merchant', () => {
    const rules = [
      rule({ field: 'merchant', pattern: 'acme', categoryId: 'cat-acme' }),
    ]
    expect(
      matchCategorizationRule(rules, {
        description: 'Check',
        merchant: 'Acme Plumbing',
        amountCents: -20000,
      }),
    ).toBe('cat-acme')
  })

  it('falls back to an empty string when merchant is missing', () => {
    const rules = [rule({ field: 'merchant', pattern: 'acme' })]
    expect(
      matchCategorizationRule(rules, {
        description: 'Check',
        amountCents: -20000,
      }),
    ).toBeNull()
  })

  it('treats an invalid regex pattern as a non-match rather than throwing', () => {
    const rules = [rule({ matchType: 'regex', pattern: '(unterminated' })]
    expect(() =>
      matchCategorizationRule(rules, {
        description: 'anything',
        amountCents: -100,
      }),
    ).not.toThrow()
  })
})
