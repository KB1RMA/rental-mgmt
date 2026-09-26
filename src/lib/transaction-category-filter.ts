export const UNCATEGORIZED_CATEGORY_FILTER = 'uncategorized'

interface FilterableTransaction {
  categoryId: string | null
  splits: { categoryId: string }[]
}

/**
 * A transaction's own categoryId is never cleared when it's split (see
 * transaction-splits.functions.ts), so once a transaction has splits, only
 * the splits are authoritative for what category its money is in. Mirrors
 * the convention in profit/monthly-pnl.ts's expandLineItems and
 * rent-ledger.functions.ts's getPaymentCandidatesForProperty — keep those in
 * sync if this ever changes.
 */
export function transactionMatchesCategory(
  transaction: FilterableTransaction,
  categoryId: string,
): boolean {
  return transaction.splits.length > 0
    ? transaction.splits.some((split) => split.categoryId === categoryId)
    : transaction.categoryId === categoryId
}

export function transactionIsUncategorized(
  transaction: FilterableTransaction,
): boolean {
  return transaction.categoryId == null && transaction.splits.length === 0
}
