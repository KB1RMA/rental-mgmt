import Papa from 'papaparse'

interface RawCsvRow {
  fiscal_year?: string
  land?: string
  building?: string
  total?: string
  tax_rate?: string
  annual_tax?: string
  source_url?: string
}

export interface ParsedAssessmentRow {
  fiscalYear: number
  assessedLandCents: number
  assessedBuildingCents: number
  assessedTotalCents: number
  taxRateMillsX100: number
  annualTaxCents: number
  sourceUrl: string | null
}

export interface CsvParseError {
  row: number
  message: string
}

export interface AssessmentCsvParseResult {
  rows: ParsedAssessmentRow[]
  errors: CsvParseError[]
}

export function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const amount = Number(cleaned)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

export function computeAnnualTaxCents(
  totalCents: number,
  taxRateMillsX100: number,
): number {
  return Math.round((totalCents * taxRateMillsX100) / 100000)
}

export function parseTaxAssessmentsCsv(
  csvText: string,
): AssessmentCsvParseResult {
  const { data, errors: parseErrors } = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const errors: CsvParseError[] = parseErrors.map((e) => ({
    row: e.row ?? -1,
    message: e.message,
  }))

  const rows: ParsedAssessmentRow[] = []
  const seenFiscalYears = new Set<number>()

  for (const [index, raw] of data.entries()) {
    const rowNumber = index + 2 // 1-indexed + header row

    const fiscalYearRaw = raw.fiscal_year?.trim()
    const fiscalYear = fiscalYearRaw ? Number(fiscalYearRaw) : NaN
    if (
      !fiscalYearRaw ||
      !Number.isInteger(fiscalYear) ||
      fiscalYear < 1900 ||
      fiscalYear > 2100
    ) {
      errors.push({
        row: rowNumber,
        message: `Invalid fiscal_year: ${fiscalYearRaw ?? ''}`,
      })
      continue
    }

    if (seenFiscalYears.has(fiscalYear)) {
      errors.push({
        row: rowNumber,
        message: `Duplicate fiscal_year in file: ${fiscalYear}`,
      })
      continue
    }

    const landCents = raw.land ? parseDollarsToCents(raw.land) : null
    if (landCents == null) {
      errors.push({
        row: rowNumber,
        message: `Invalid land: ${raw.land ?? ''}`,
      })
      continue
    }

    const buildingCents = raw.building
      ? parseDollarsToCents(raw.building)
      : null
    if (buildingCents == null) {
      errors.push({
        row: rowNumber,
        message: `Invalid building: ${raw.building ?? ''}`,
      })
      continue
    }

    const totalRaw = raw.total?.trim()
    const totalCents = totalRaw
      ? parseDollarsToCents(totalRaw)
      : landCents + buildingCents
    if (totalCents == null) {
      errors.push({ row: rowNumber, message: `Invalid total: ${totalRaw}` })
      continue
    }

    const taxRateRaw = raw.tax_rate?.trim()
    const taxRate = taxRateRaw ? Number(taxRateRaw) : NaN
    if (!taxRateRaw || !Number.isFinite(taxRate) || taxRate < 0) {
      errors.push({
        row: rowNumber,
        message: `Invalid tax_rate: ${taxRateRaw ?? ''}`,
      })
      continue
    }
    const taxRateMillsX100 = Math.round(taxRate * 100)

    const annualTaxRaw = raw.annual_tax?.trim()
    const annualTaxCents = annualTaxRaw
      ? parseDollarsToCents(annualTaxRaw)
      : computeAnnualTaxCents(totalCents, taxRateMillsX100)
    if (annualTaxCents == null) {
      errors.push({
        row: rowNumber,
        message: `Invalid annual_tax: ${annualTaxRaw}`,
      })
      continue
    }

    seenFiscalYears.add(fiscalYear)
    rows.push({
      fiscalYear,
      assessedLandCents: landCents,
      assessedBuildingCents: buildingCents,
      assessedTotalCents: totalCents,
      taxRateMillsX100,
      annualTaxCents,
      sourceUrl: raw.source_url?.trim() || null,
    })
  }

  return { rows, errors }
}
