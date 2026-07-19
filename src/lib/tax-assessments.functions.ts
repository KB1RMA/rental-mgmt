import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '#/lib/auth-middleware'
import {
  parseDollarsToCents,
  parseTaxAssessmentsCsv,
  computeAnnualTaxCents,
} from '#/lib/csv/parse-tax-assessments'
import type { CsvParseError } from '#/lib/csv/parse-tax-assessments'
import {
  deleteTaxAssessmentById,
  listAssessmentFiscalYears,
  listTaxAssessmentsForProperty,
  upsertTaxAssessment,
} from '#/db/repositories/tax-assessments'
import { listProperties } from '#/db/repositories/properties'

export interface AssessmentImportSummary {
  imported: number
  updated: number
  parseErrors: CsvParseError[]
}

async function getCurrentProperty() {
  const properties = await listProperties()
  const property = properties.at(0)
  if (!property) throw new Error('No property configured yet')
  return property
}

export const getTaxAssessmentsPageData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const property = await getCurrentProperty()
    const assessments = await listTaxAssessmentsForProperty(property.id)
    return { assessments }
  })

function parseUploadForm(data: unknown) {
  if (!(data instanceof FormData)) throw new Error('Expected FormData')
  const file = data.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('A CSV file is required')
  }
  return { file }
}

export const importTaxAssessmentsCsv = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(parseUploadForm)
  .handler(async ({ data }): Promise<AssessmentImportSummary> => {
    const property = await getCurrentProperty()
    const [csvText, existingFiscalYears] = await Promise.all([
      data.file.text(),
      listAssessmentFiscalYears(property.id),
    ])

    const { rows, errors } = parseTaxAssessmentsCsv(csvText)

    const summary: AssessmentImportSummary = {
      imported: 0,
      updated: 0,
      parseErrors: errors,
    }

    for (const row of rows) {
      await upsertTaxAssessment({
        propertyId: property.id,
        fiscalYear: row.fiscalYear,
        assessedLandCents: row.assessedLandCents,
        assessedBuildingCents: row.assessedBuildingCents,
        assessedTotalCents: row.assessedTotalCents,
        taxRateMillsX100: row.taxRateMillsX100,
        annualTaxCents: row.annualTaxCents,
        sourceUrl: row.sourceUrl,
      })
      if (existingFiscalYears.has(row.fiscalYear)) {
        summary.updated += 1
      } else {
        summary.imported += 1
      }
    }

    return summary
  })

const manualEntrySchema = z.object({
  fiscalYear: z.string(),
  land: z.string(),
  building: z.string(),
  total: z.string().optional(),
  taxRate: z.string(),
  annualTax: z.string().optional(),
})

export const createTaxAssessment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(manualEntrySchema)
  .handler(async ({ data }) => {
    const property = await getCurrentProperty()

    const fiscalYear = Number(data.fiscalYear)
    if (
      !Number.isInteger(fiscalYear) ||
      fiscalYear < 1900 ||
      fiscalYear > 2100
    ) {
      throw new Error(`Invalid fiscal year: ${data.fiscalYear}`)
    }

    const landCents = parseDollarsToCents(data.land)
    if (landCents == null) throw new Error(`Invalid land value: ${data.land}`)

    const buildingCents = parseDollarsToCents(data.building)
    if (buildingCents == null) {
      throw new Error(`Invalid building value: ${data.building}`)
    }

    const totalCents = data.total?.trim()
      ? parseDollarsToCents(data.total)
      : landCents + buildingCents
    if (totalCents == null)
      throw new Error(`Invalid total value: ${data.total}`)

    const taxRate = Number(data.taxRate)
    if (!Number.isFinite(taxRate) || taxRate < 0) {
      throw new Error(`Invalid tax rate: ${data.taxRate}`)
    }
    const taxRateMillsX100 = Math.round(taxRate * 100)

    const annualTaxCents = data.annualTax?.trim()
      ? parseDollarsToCents(data.annualTax)
      : computeAnnualTaxCents(totalCents, taxRateMillsX100)
    if (annualTaxCents == null) {
      throw new Error(`Invalid annual tax value: ${data.annualTax}`)
    }

    return upsertTaxAssessment({
      propertyId: property.id,
      fiscalYear,
      assessedLandCents: landCents,
      assessedBuildingCents: buildingCents,
      assessedTotalCents: totalCents,
      taxRateMillsX100,
      annualTaxCents,
      sourceUrl: null,
    })
  })

export const deleteTaxAssessment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await deleteTaxAssessmentById(data.id)
  })
