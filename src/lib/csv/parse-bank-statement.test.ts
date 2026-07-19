import { describe, expect, it } from 'vitest'

import { parseBankStatementCsv } from './parse-bank-statement'

const meta = [
  'Account Name : Example Account',
  'Account Number : 0000000000',
  'Date Range : 01/01/2026-12/31/2026',
  'Transaction Number,Date,Description,Memo,Amount Debit,Amount Credit,Balance,Check Number',
]

function csv(...rows: string[]) {
  return [...meta, ...rows].join('\n')
}

describe('parseBankStatementCsv', () => {
  it('skips the metadata header lines and parses a credit row', async () => {
    const { rows, errors } = await parseBankStatementCsv(
      csv('"txn1",04/01/2026,"Remote Deposit","",,2950.00,1000.00,'),
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      postedDate: '2026-04-01',
      amountCents: 295000,
      description: 'Remote Deposit',
      sourceCategory: '',
    })
  })

  it('parses a debit row (already negative)', async () => {
    const { rows } = await parseBankStatementCsv(
      csv('"txn2",04/09/2026,"Check","",-189.34,,800.00,101'),
    )
    expect(rows[0].amountCents).toBe(-18934)
  })

  it('uses the Memo column as notes', async () => {
    const { rows } = await parseBankStatementCsv(
      csv(
        '"txn3",06/08/2026,"INFOSN CK WEBXFR/FEE $10.00","REFERENCE 123",-2210.00,,500.00,',
      ),
    )
    expect(rows[0].notes).toBe('REFERENCE 123')
  })

  it('reports an error when the header row is missing', async () => {
    const { rows, errors } = await parseBankStatementCsv(
      'not,a,real,statement\n1,2,3,4',
    )
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/header row/)
  })

  it('reports a row-level error for an unparseable date', async () => {
    const { rows, errors } = await parseBankStatementCsv(
      csv('"txn4",not-a-date,"Check","",-10.00,,100.00,'),
    )
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Unrecognized date/)
  })
})
