import Papa from 'papaparse'

interface RawCsvRow {
  Date?: string
  Name?: string
  Notes?: string
  Category?: string
  'Sub-Category'?: string
  Amount?: string
  Account?: string
}

export interface ParsedCsvRow {
  postedDate: string
  amountCents: number
  description: string
  notes: string
  sourceCategory: string
  sourceSubCategory: string
  account: string
  dedupeHash: string
}

export interface CsvParseError {
  row: number
  message: string
}

export interface CsvParseResult {
  rows: ParsedCsvRow[]
  errors: CsvParseError[]
}

function mmddyyyyToIso(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export async function dedupeHash(
  postedDate: string,
  amountCents: number,
  description: string,
): Promise<string> {
  const normalized = `${postedDate}|${amountCents}|${description.trim().toLowerCase()}`
  const bytes = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function parseTransactionsCsv(
  csvText: string,
): Promise<CsvParseResult> {
  const { data, errors: parseErrors } = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const errors: CsvParseError[] = parseErrors.map((e) => ({
    row: e.row ?? -1,
    message: e.message,
  }))

  const rows: ParsedCsvRow[] = []
  for (const [index, raw] of data.entries()) {
    const rowNumber = index + 2 // 1-indexed + header row
    const dateRaw = raw.Date?.trim()
    const amountRaw = raw.Amount?.trim()
    const description = raw.Name?.trim()

    if (!dateRaw || !amountRaw || !description) {
      errors.push({ row: rowNumber, message: 'Missing Date, Amount, or Name' })
      continue
    }

    const postedDate = mmddyyyyToIso(dateRaw)
    if (!postedDate) {
      errors.push({ row: rowNumber, message: `Unrecognized date: ${dateRaw}` })
      continue
    }

    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) {
      errors.push({
        row: rowNumber,
        message: `Unrecognized amount: ${amountRaw}`,
      })
      continue
    }
    const amountCents = Math.round(amount * 100)

    rows.push({
      postedDate,
      amountCents,
      description,
      notes: raw.Notes?.trim() ?? '',
      sourceCategory: raw.Category?.trim() ?? '',
      sourceSubCategory: raw['Sub-Category']?.trim() ?? '',
      account: raw.Account?.trim() ?? '',
      dedupeHash: await dedupeHash(postedDate, amountCents, description),
    })
  }

  return { rows, errors }
}
