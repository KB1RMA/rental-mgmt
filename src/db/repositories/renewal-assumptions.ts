import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { renewalAssumptions } from '#/db/schema'

export type NewRenewalAssumptions = typeof renewalAssumptions.$inferInsert

export function getRenewalAssumptionsForProperty(propertyId: string) {
  return db.query.renewalAssumptions.findFirst({
    where: eq(renewalAssumptions.propertyId, propertyId),
  })
}

export function upsertRenewalAssumptions(input: NewRenewalAssumptions) {
  return db
    .insert(renewalAssumptions)
    .values(input)
    .onConflictDoUpdate({
      target: renewalAssumptions.propertyId,
      set: {
        proposedRentCents: input.proposedRentCents,
        monthlyPrincipalCents: input.monthlyPrincipalCents,
        monthlyExpenseOverrideCents: input.monthlyExpenseOverrideCents,
        notes: input.notes,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get()
}
