import { describe, expect, it } from 'vitest'

import {
  computeAnnualTaxCents,
  parseDollarsToCents,
  parseTaxAssessmentsCsv,
} from './parse-tax-assessments'

const header = 'fiscal_year,land,building,total,tax_rate,annual_tax,source_url'

function csv(...rows: string[]) {
  return [header, ...rows].join('\n')
}

describe('parseTaxAssessmentsCsv', () => {
  it('parses a valid row', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,100000,200000,300000,9.50,2850.00,https://example.com/parcel'),
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      fiscalYear: 2026,
      assessedLandCents: 10000000,
      assessedBuildingCents: 20000000,
      assessedTotalCents: 30000000,
      taxRateMillsX100: 950,
      annualTaxCents: 285000,
      sourceUrl: 'https://example.com/parcel',
    })
  })

  it('strips $ and commas from dollar fields', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,"$1,000",2000,3000,9.5,,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].assessedLandCents).toBe(100000)
  })

  it('derives total from land + building when blank', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,1000,2000,,9.5,,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].assessedTotalCents).toBe(300000)
  })

  it('respects an explicit total instead of deriving it', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,1000,2000,3500,9.5,,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].assessedTotalCents).toBe(350000)
  })

  it('derives annual_tax from total x rate when blank', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,0,850000,,11.24,,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].annualTaxCents).toBe(955400)
  })

  it('respects an explicit annual_tax instead of deriving it', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,0,850000,,11.24,9500.00,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].annualTaxCents).toBe(950000)
  })

  it('defaults sourceUrl to null when blank', () => {
    const { rows } = parseTaxAssessmentsCsv(csv('2026,1000,2000,,9.5,,'))
    expect(rows[0].sourceUrl).toBeNull()
  })

  it('reports a row-level error for an invalid fiscal_year without failing the whole file', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,1000,2000,,9.5,,', 'not-a-year,1000,2000,,9.5,,'),
    )
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Invalid fiscal_year/)
  })

  it('reports an error for a negative or non-numeric land value', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,-100,2000,,9.5,,'),
    )
    expect(rows).toHaveLength(0)
    expect(errors[0].message).toMatch(/Invalid land/)
  })

  it('reports an error for a missing tax_rate', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(csv('2026,1000,2000,,,,'))
    expect(rows).toHaveLength(0)
    expect(errors[0].message).toMatch(/Invalid tax_rate/)
  })

  it('reports an error for a duplicate fiscal_year within the file', () => {
    const { rows, errors } = parseTaxAssessmentsCsv(
      csv('2026,1000,2000,,9.5,,', '2026,1500,2500,,9.6,,'),
    )
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Duplicate fiscal_year/)
  })
})

describe('parseDollarsToCents', () => {
  it('parses plain dollar amounts', () => {
    expect(parseDollarsToCents('123.45')).toBe(12345)
  })

  it('strips $ and commas', () => {
    expect(parseDollarsToCents('$1,234.50')).toBe(123450)
  })

  it('returns null for blank input', () => {
    expect(parseDollarsToCents('')).toBeNull()
  })

  it('returns null for negative amounts', () => {
    expect(parseDollarsToCents('-5')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parseDollarsToCents('abc')).toBeNull()
  })
})

describe('computeAnnualTaxCents', () => {
  it('computes annual tax from total cents and mills x100', () => {
    // $850,000 total at $11.24/$1,000 => $9,554.00
    expect(computeAnnualTaxCents(85000000, 1124)).toBe(955400)
  })

  it('rounds to the nearest cent', () => {
    expect(computeAnnualTaxCents(33333, 950)).toBe(317) // 316.6635 -> 317
  })
})
