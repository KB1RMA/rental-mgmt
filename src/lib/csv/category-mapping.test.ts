import { describe, expect, it } from 'vitest'

import { mapSourceCategory } from './category-mapping'

describe('mapSourceCategory', () => {
  it('maps known category/sub-category pairs', () => {
    expect(mapSourceCategory('Income', 'Rents')).toBe('Rent Income')
    expect(mapSourceCategory('Utilities', 'Water & Sewer')).toBe('Utilities')
    expect(mapSourceCategory('Repairs & Maintenance', 'Snow Removal')).toBe(
      'Repairs',
    )
    expect(mapSourceCategory('Admin & Other', 'HOA Dues')).toBe(
      'Other Expenses',
    )
    expect(mapSourceCategory('Transfers', 'Owner Distributions')).toBe(
      'Owner Distributions',
    )
  })

  it('falls back to category-only mapping for an unrecognized sub-category', () => {
    expect(mapSourceCategory('Repairs & Maintenance', 'Roof Repair')).toBe(
      'Repairs',
    )
  })

  it('maps Security Deposits with no sub-category', () => {
    expect(mapSourceCategory('Security Deposits', '')).toBe('Security Deposits')
  })

  it('returns null for a blank source category', () => {
    expect(mapSourceCategory('', '')).toBeNull()
  })

  it('returns null for a completely unrecognized category', () => {
    expect(mapSourceCategory('Something New', 'Whatever')).toBeNull()
  })
})
