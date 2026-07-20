import { eq, inArray } from 'drizzle-orm'

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
 * Atomically replaces all splits for a transaction with a new set, migrating
 * any rent-ledger payment linked to it onto the new shape rather than
 * dropping it:
 *
 * - A split-linked payment is re-pointed at whichever new split has the same
 *   (category, amount) — i.e. the same economic line survived the edit (a
 *   notes tweak, or an edit to a *different* split line). A reconciled payment
 *   is preserved instead of being silently un-paid by an unrelated edit.
 * - A payment whose line no longer exists (its amount/category changed, or
 *   the splits were cleared) is deleted — that link is genuinely stale.
 * - A whole-transaction payment is deleted once the transaction is split
 *   (its "whole transaction" line no longer exists), but survives when
 *   splits are cleared back to a whole transaction.
 */
export async function replaceTransactionSplits(
  transactionId: string,
  splits: Omit<NewTransactionSplit, 'transactionId'>[],
) {
  const [existingSplits, linkedPayments] = await Promise.all([
    db.query.transactionSplits.findMany({
      where: eq(transactionSplits.transactionId, transactionId),
      columns: { id: true, categoryId: true, amountCents: true },
    }),
    db.query.rentPayments.findMany({
      where: eq(rentPayments.transactionId, transactionId),
      columns: { id: true, transactionSplitId: true },
    }),
  ])

  const newSplits = splits.map((split) => ({
    ...split,
    id: crypto.randomUUID(),
    transactionId,
  }))

  // (category, amount) → new split ids, each claimable once, so a payment
  // migrates to exactly one surviving line even if two lines look identical.
  const newSplitsByShape = new Map<string, string[]>()
  for (const split of newSplits) {
    const key = `${split.categoryId}:${split.amountCents}`
    const bucket = newSplitsByShape.get(key)
    if (bucket) bucket.push(split.id)
    else newSplitsByShape.set(key, [split.id])
  }
  const oldSplitShape = new Map(
    existingSplits.map((split) => [
      split.id,
      `${split.categoryId}:${split.amountCents}`,
    ]),
  )

  const paymentWrites = linkedPayments.map((payment) => {
    if (payment.transactionSplitId == null) {
      // Whole-transaction payment: valid only while the transaction stays
      // whole. Deleting the split set (length 0) leaves it intact.
      return newSplits.length === 0
        ? null
        : db.delete(rentPayments).where(eq(rentPayments.id, payment.id))
    }

    const shape = oldSplitShape.get(payment.transactionSplitId)
    const match = shape ? newSplitsByShape.get(shape)?.shift() : undefined
    if (match) {
      return db
        .update(rentPayments)
        .set({ transactionSplitId: match })
        .where(eq(rentPayments.id, payment.id))
    }
    return db.delete(rentPayments).where(eq(rentPayments.id, payment.id))
  })

  // Order matters: the old splits can't be deleted while a payment still
  // references them (the transaction_split_id FK has no ON DELETE action —
  // see migration 0009 — so a dangling reference errors rather than nulling).
  // So insert the new splits first, re-point/clear the payments off the old
  // splits, and only then delete the old splits — by id, not by transactionId,
  // which would also delete the rows just inserted.
  const statements = [
    ...(newSplits.length > 0
      ? [db.insert(transactionSplits).values(newSplits)]
      : []),
    ...paymentWrites.filter((write) => write != null),
    ...(existingSplits.length > 0
      ? [
          db.delete(transactionSplits).where(
            inArray(
              transactionSplits.id,
              existingSplits.map((split) => split.id),
            ),
          ),
        ]
      : []),
  ]

  if (statements.length === 0) return
  const [first, ...rest] = statements
  return db.batch([first, ...rest])
}
