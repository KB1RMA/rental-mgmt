import { and, desc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { transactionSplits, transactions } from '#/db/schema'

export type NewTransaction = typeof transactions.$inferInsert

export async function transactionExistsByHash(dedupeHash: string) {
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.dedupeHash, dedupeHash),
    columns: { id: true },
  })
  return existing != null
}

export function createTransaction(input: NewTransaction) {
  return db.insert(transactions).values(input).returning().get()
}

export function listTransactionsWithCategory() {
  return db.query.transactions.findMany({
    with: {
      category: true,
      splits: { with: { category: true } },
    },
    orderBy: desc(transactions.postedDate),
  })
}

export function listTransactionsByCategory(
  propertyId: string,
  categoryId: string,
) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.propertyId, propertyId),
      eq(transactions.categoryId, categoryId),
    ),
    orderBy: transactions.postedDate,
  })
}

export function listTransactionsForProperty(propertyId: string) {
  return db.query.transactions.findMany({
    where: eq(transactions.propertyId, propertyId),
    with: {
      category: true,
      splits: { with: { category: true } },
    },
    orderBy: desc(transactions.postedDate),
  })
}

export function getTransactionById(id: string) {
  return db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  })
}

export function getTransactionSplitById(id: string) {
  return db.query.transactionSplits.findFirst({
    where: eq(transactionSplits.id, id),
  })
}

export function updateTransactionCategory(id: string, categoryId: string) {
  return db
    .update(transactions)
    .set({ categoryId, categorizedBy: 'manual' })
    .where(eq(transactions.id, id))
    .returning()
    .get()
}

export function deleteTransactionById(id: string) {
  return db.delete(transactions).where(eq(transactions.id, id)).run()
}
