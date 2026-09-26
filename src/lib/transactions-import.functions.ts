import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '#/lib/auth-middleware'
import { parseTransactionsCsv } from '#/lib/csv/parse'
import type { CsvParseResult } from '#/lib/csv/parse'
import { parseBankStatementCsv } from '#/lib/csv/parse-bank-statement'
import { mapSourceCategory } from '#/lib/csv/category-mapping'
import { matchCategorizationRule } from '#/lib/rules/engine'
import {
  listCategories,
  listActiveCategorizationRules,
} from '#/db/repositories/categories'
import {
  createTransaction,
  transactionExistsByHash,
} from '#/db/repositories/transactions'
import { listProperties } from '#/db/repositories/properties'

export const csvImportFormats = ['property-manager', 'bank-statement'] as const
export type CsvImportFormat = (typeof csvImportFormats)[number]

export interface ImportSummary {
  imported: number
  duplicates: number
  uncategorized: number
  parseErrors: { row: number; message: string }[]
}

// retry-once.ts retries an import on a transient "Failed to fetch" — but by
// then the first attempt may have already committed to D1, so a naive retry
// re-reads its own rows as duplicates and under-reports what actually
// imported. The client sends the same requestId on both the original call
// and the retry, so the retry can return the first call's real result
// instead of recomputing it against data it just wrote. Module-scope, like
// other per-isolate state in this app — fine for the dev-mode cold-start
// this exists for; a cache miss in production just falls back to today's
// behavior.
const recentImportResults = new Map<
  string,
  { summary: ImportSummary; at: number }
>()
const RECENT_IMPORT_TTL_MS = 30_000

function rememberImportResult(requestId: string, summary: ImportSummary) {
  const now = Date.now()
  for (const [key, entry] of recentImportResults) {
    if (now - entry.at > RECENT_IMPORT_TTL_MS) recentImportResults.delete(key)
  }
  recentImportResults.set(requestId, { summary, at: now })
}

function parseUploadForm(data: unknown) {
  if (!(data instanceof FormData)) throw new Error('Expected FormData')
  const file = data.get('file')
  const format = data.get('format')
  const requestId = data.get('requestId')
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('A CSV file is required')
  }
  if (
    typeof format !== 'string' ||
    !csvImportFormats.includes(format as CsvImportFormat)
  ) {
    throw new Error('Invalid import format')
  }
  if (typeof requestId !== 'string' || !requestId) {
    throw new Error('Missing requestId')
  }
  return { file, format: format as CsvImportFormat, requestId }
}

export const importTransactionsCsv = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(parseUploadForm)
  .handler(async ({ data }): Promise<ImportSummary> => {
    const cached = recentImportResults.get(data.requestId)
    if (cached && Date.now() - cached.at <= RECENT_IMPORT_TTL_MS) {
      return cached.summary
    }

    const [csvText, categories, rules, properties] = await Promise.all([
      data.file.text(),
      listCategories(),
      listActiveCategorizationRules(),
      listProperties(),
    ])

    const property = properties.at(0)
    if (!property) throw new Error('No property configured yet')

    const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

    const parse: (text: string) => Promise<CsvParseResult> =
      data.format === 'bank-statement'
        ? parseBankStatementCsv
        : parseTransactionsCsv
    const { rows, errors } = await parse(csvText)

    const summary: ImportSummary = {
      imported: 0,
      duplicates: 0,
      uncategorized: 0,
      parseErrors: errors,
    }

    for (const row of rows) {
      if (await transactionExistsByHash(row.dedupeHash)) {
        summary.duplicates += 1
        continue
      }

      const mappedName = mapSourceCategory(
        row.sourceCategory,
        row.sourceSubCategory,
      )
      let categoryId = mappedName ? categoryIdByName.get(mappedName) : undefined
      let categorizedBy: 'imported' | 'rule' | null = categoryId
        ? 'imported'
        : null

      if (!categoryId) {
        const ruleCategoryId = matchCategorizationRule(rules, {
          description: row.description,
          amountCents: row.amountCents,
        })
        if (ruleCategoryId) {
          categoryId = ruleCategoryId
          categorizedBy = 'rule'
        }
      }

      if (!categoryId) summary.uncategorized += 1

      await createTransaction({
        propertyId: property.id,
        postedDate: row.postedDate,
        amountCents: row.amountCents,
        description: row.description,
        source: 'csv',
        dedupeHash: row.dedupeHash,
        categoryId: categoryId ?? null,
        categorizedBy,
        notes: row.notes || null,
      })
      summary.imported += 1
    }

    rememberImportResult(data.requestId, summary)
    return summary
  })
