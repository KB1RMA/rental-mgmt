import { describe, expect, it } from 'vitest'

import { dedupeHash, parseTransactionsCsv } from './parse'

const header =
  'Date,Name,Notes,Details,Category,Sub-Category,Amount,Portfolio,Property,Unit,Data Source,Account,Owner,Attachments,Portfolio ID,Tenancy ID'

function csv(...rows: string[]) {
  return [header, ...rows].join('\n')
}

describe('parseTransactionsCsv', () => {
  it('parses rows into normalized fields', async () => {
    const { rows, errors } = await parseTransactionsCsv(
      csv(
        '04/01/2026,Remote Deposit,Remote Deposit,,Income,Rents,2950.0,Example Portfolio,123 Example St,1,Example Bank,Checking,,,,',
      ),
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      postedDate: '2026-04-01',
      amountCents: 295000,
      description: 'Remote Deposit',
      sourceCategory: 'Income',
      sourceSubCategory: 'Rents',
    })
  })

  it('handles negative amounts and single-digit month/day', async () => {
    const { rows } = await parseTransactionsCsv(
      csv('4/2/2026,Check,Check,,Repairs,Plumbing,-189.34,,,,,,,,,'),
    )
    expect(rows[0].postedDate).toBe('2026-04-02')
    expect(rows[0].amountCents).toBe(-18934)
  })

  it('reports a row-level error for an unparseable date without failing the whole file', async () => {
    const { rows, errors } = await parseTransactionsCsv(
      csv(
        '04/01/2026,Good Row,,,,,-10.00,,,,,,,,,',
        'not-a-date,Bad Row,,,,,-10.00,,,,,,,,,',
      ),
    )
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Unrecognized date/)
  })

  it('reports an error for a row missing required fields', async () => {
    const { rows, errors } = await parseTransactionsCsv(csv(',,,,,,,,,,,,,,,'))
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })
})

describe('dedupeHash', () => {
  it('is deterministic for identical inputs', async () => {
    const a = await dedupeHash('2026-04-01', -1000, 'ATM Withdrawal')
    const b = await dedupeHash('2026-04-01', -1000, 'ATM Withdrawal')
    expect(a).toBe(b)
  })

  it('is case- and whitespace-insensitive on description', async () => {
    const a = await dedupeHash('2026-04-01', -1000, 'ATM Withdrawal')
    const b = await dedupeHash('2026-04-01', -1000, '  atm withdrawal  ')
    expect(a).toBe(b)
  })

  it('differs when amount differs', async () => {
    const a = await dedupeHash('2026-04-01', -1000, 'ATM Withdrawal')
    const b = await dedupeHash('2026-04-01', -1001, 'ATM Withdrawal')
    expect(a).not.toBe(b)
  })
})
