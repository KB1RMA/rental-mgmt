import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { rentPayments, transactionSplits } from '#/db/schema'

export type NewTransactionSplit = typeof transactionSplits.$inferInsert

export function listSplitsForTransaction(transactionId: string) {
  return db.query.transactionSplits.findMany({
    where: eq(transactionSplits.transactionId, transactionId),
    with: { category: true },
  })
}

/**
 * Atomically replaces all splits for a transaction with a new set, and
 * clears any rent-ledger payment linked to it (whole-transaction or a split
 * line being replaced) — that link was made against the transaction's old
 * shape and would otherwise survive as stale, silently-wrong ledger data.
 * The reconcile picker will offer the transaction's new line items as fresh
 * candidates.
 */
export function replaceTransactionSplits(
  transactionId: string,
  splits: Omit<NewTransactionSplit, 'transactionId'>[],
) {
  const deleteExisting = db
    .delete(transactionSplits)
    .where(eq(transactionSplits.transactionId, transactionId))
  const deleteRentPayments = db
    .delete(rentPayments)
    .where(eq(rentPayments.transactionId, transactionId))

  if (splits.length === 0) {
    return db.batch([deleteExisting, deleteRentPayments])
  }

  const insertNew = db
    .insert(transactionSplits)
    .values(splits.map((split) => ({ ...split, transactionId })))

  return db.batch([deleteExisting, deleteRentPayments, insertNew])
}
