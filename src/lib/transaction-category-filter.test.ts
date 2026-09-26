import { describe, expect, test } from 'vitest'

import {
  transactionIsUncategorized,
  transactionMatchesCategory,
} from './transaction-category-filter'

describe('transactionMatchesCategory', () => {
  test('matches on the transaction category when it has no splits', () => {
    const transaction = { categoryId: 'rent', splits: [] }
    expect(transactionMatchesCategory(transaction, 'rent')).toBe(true)
    expect(transactionMatchesCategory(transaction, 'repairs')).toBe(false)
  })

  test('matches on any split category, ignoring a stale own category', () => {
    const transaction = {
      categoryId: 'rent',
      splits: [{ categoryId: 'repairs' }, { categoryId: 'deposits' }],
    }
    expect(transactionMatchesCategory(transaction, 'repairs')).toBe(true)
    expect(transactionMatchesCategory(transaction, 'deposits')).toBe(true)
    // The transaction's own categoryId is stale once it's split.
    expect(transactionMatchesCategory(transaction, 'rent')).toBe(false)
  })
})

describe('transactionIsUncategorized', () => {
  test('is true only when there is no category and no splits', () => {
    expect(transactionIsUncategorized({ categoryId: null, splits: [] })).toBe(
      true,
    )
    expect(transactionIsUncategorized({ categoryId: 'rent', splits: [] })).toBe(
      false,
    )
    expect(
      transactionIsUncategorized({
        categoryId: null,
        splits: [{ categoryId: 'repairs' }],
      }),
    ).toBe(false)
  })
})
