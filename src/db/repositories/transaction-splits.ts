import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { transactionSplits } from '#/db/schema'

export type NewTransactionSplit = typeof transactionSplits.$inferInsert

export function listSplitsForTransaction(transactionId: string) {
  return db.query.transactionSplits.findMany({
    where: eq(transactionSplits.transactionId, transactionId),
    with: { category: true },
  })
}

/** Atomically replaces all splits for a transaction with a new set. */
export function replaceTransactionSplits(
  transactionId: string,
  splits: Omit<NewTransactionSplit, 'transactionId'>[],
) {
  const deleteExisting = db
    .delete(transactionSplits)
    .where(eq(transactionSplits.transactionId, transactionId))

  if (splits.length === 0) {
    return db.batch([deleteExisting])
  }

  const insertNew = db
    .insert(transactionSplits)
    .values(splits.map((split) => ({ ...split, transactionId })))

  return db.batch([deleteExisting, insertNew])
}
