import { desc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { taxAssessments } from '#/db/schema'

export type NewTaxAssessment = typeof taxAssessments.$inferInsert

export function listTaxAssessmentsForProperty(propertyId: string) {
  return db.query.taxAssessments.findMany({
    where: eq(taxAssessments.propertyId, propertyId),
    orderBy: desc(taxAssessments.fiscalYear),
  })
}

export async function listAssessmentFiscalYears(propertyId: string) {
  const rows = await db.query.taxAssessments.findMany({
    where: eq(taxAssessments.propertyId, propertyId),
    columns: { fiscalYear: true },
  })
  return new Set(rows.map((r) => r.fiscalYear))
}

export function upsertTaxAssessment(input: NewTaxAssessment) {
  return db
    .insert(taxAssessments)
    .values(input)
    .onConflictDoUpdate({
      target: [taxAssessments.propertyId, taxAssessments.fiscalYear],
      set: {
        assessedLandCents: input.assessedLandCents,
        assessedBuildingCents: input.assessedBuildingCents,
        assessedTotalCents: input.assessedTotalCents,
        taxRateMillsX100: input.taxRateMillsX100,
        annualTaxCents: input.annualTaxCents,
        sourceUrl: input.sourceUrl,
      },
    })
    .returning()
    .get()
}

export function deleteTaxAssessmentById(id: string) {
  return db.delete(taxAssessments).where(eq(taxAssessments.id, id)).run()
}
