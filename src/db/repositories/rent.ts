import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { rentCharges, rentPayments } from '#/db/schema'

export type NewRentCharge = typeof rentCharges.$inferInsert
export type NewRentPayment = typeof rentPayments.$inferInsert

export function listRentChargesForLease(leaseId: string) {
  return db.query.rentCharges.findMany({
    where: eq(rentCharges.leaseId, leaseId),
    with: { rentPayments: true },
    orderBy: (charges, { asc }) => [asc(charges.period)],
  })
}

export function getRentChargeForPeriod(leaseId: string, period: string) {
  return db.query.rentCharges.findFirst({
    where: and(
      eq(rentCharges.leaseId, leaseId),
      eq(rentCharges.period, period),
    ),
  })
}

export function createRentCharge(input: NewRentCharge) {
  return db.insert(rentCharges).values(input).returning().get()
}

export function updateRentChargeStatus(
  id: string,
  status: (typeof rentCharges.$inferSelect)['status'],
) {
  return db
    .update(rentCharges)
    .set({ status })
    .where(eq(rentCharges.id, id))
    .returning()
    .get()
}

export function createRentPayment(input: NewRentPayment) {
  return db.insert(rentPayments).values(input).returning().get()
}

export function updateRentChargeAmount(id: string, amountCents: number) {
  return db
    .update(rentCharges)
    .set({ amountCents })
    .where(eq(rentCharges.id, id))
    .returning()
    .get()
}

export function deleteRentPayment(id: string) {
  return db.delete(rentPayments).where(eq(rentPayments.id, id)).run()
}

export async function listLinkedTransactionRefs() {
  const rows = await db.query.rentPayments.findMany({
    columns: { transactionId: true, transactionSplitId: true },
  })
  return {
    transactionIds: new Set(
      rows.map((row) => row.transactionId).filter((id) => id != null),
    ),
    splitIds: new Set(
      rows.map((row) => row.transactionSplitId).filter((id) => id != null),
    ),
  }
}
