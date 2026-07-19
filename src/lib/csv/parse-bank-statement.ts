import Papa from 'papaparse'

import { dedupeHash } from './parse'
import type { CsvParseResult } from './parse'

interface RawBankStatementRow {
  Date?: string
  Description?: string
  Memo?: string
  'Amount Debit'?: string
  'Amount Credit'?: string
}

function mmddyyyyToIso(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * A raw bank statement export: a few "Key : value" metadata lines, then the
 * real CSV header (Transaction Number, Date, Description, Memo, Amount
 * Debit, Amount Credit, Balance, Check Number). No pre-existing
 * categorization — everything relies on the rules engine or manual review.
 */
export async function parseBankStatementCsv(
  csvText: string,
): Promise<CsvParseResult> {
  const lines = csvText.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('Transaction Number,'),
  )
  if (headerIndex === -1) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'Could not find the statement header row' }],
    }
  }

  const { data, errors: parseErrors } = Papa.parse<RawBankStatementRow>(
    lines.slice(headerIndex).join('\n'),
    { header: true, skipEmptyLines: true },
  )

  const errors = parseErrors.map((e) => ({
    row: (e.row ?? -1) + headerIndex,
    message: e.message,
  }))

  const rows: CsvParseResult['rows'] = []
  for (const [index, raw] of data.entries()) {
    const rowNumber = index + headerIndex + 2
    const dateRaw = raw.Date?.trim()
    const description = raw.Description?.trim()
    const debitRaw = raw['Amount Debit']?.trim()
    const creditRaw = raw['Amount Credit']?.trim()

    if (!dateRaw || !description || (!debitRaw && !creditRaw)) {
      errors.push({
        row: rowNumber,
        message: 'Missing Date, Description, or an amount',
      })
      continue
    }

    const postedDate = mmddyyyyToIso(dateRaw)
    if (!postedDate) {
      errors.push({ row: rowNumber, message: `Unrecognized date: ${dateRaw}` })
      continue
    }

    const amount = Number(debitRaw || creditRaw)
    if (!Number.isFinite(amount)) {
      errors.push({
        row: rowNumber,
        message: `Unrecognized amount: ${debitRaw || creditRaw}`,
      })
      continue
    }
    const amountCents = Math.round(amount * 100)

    rows.push({
      postedDate,
      amountCents,
      description,
      notes: raw.Memo?.trim() ?? '',
      sourceCategory: '',
      sourceSubCategory: '',
      account: '',
      dedupeHash: await dedupeHash(postedDate, amountCents, description),
    })
  }

  return { rows, errors }
}
