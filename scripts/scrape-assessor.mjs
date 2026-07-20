#!/usr/bin/env node
// Fetches a Vision Government Solutions assessor parcel page for the
// property's parcel id, archives the raw HTML, and writes a
// tax-assessments CSV — both into the gitignored _docs/ directory. Nothing
// here touches production; the CSV is meant to be uploaded through the app's
// /tax-assessments import UI by hand.
//
// Usage: node --env-file=.env scripts/scrape-assessor.mjs

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PID = process.env.ASSESSOR_PID
if (!PID) {
  throw new Error(
    'ASSESSOR_PID is not set — add it to .env and run with --env-file=.env',
  )
}
const TOWN = process.env.ASSESSOR_TOWN
if (!TOWN) {
  throw new Error(
    'ASSESSOR_TOWN is not set — add it to .env and run with --env-file=.env',
  )
}
const PARCEL_URL = `https://gis.vgsi.com/${TOWN}/Parcel.aspx?pid=${PID}`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.join(__dirname, '..', '_docs')
const OUT_HTML = path.join(DOCS_DIR, `assessor-parcel-${PID}.html`)
const OUT_CSV = path.join(DOCS_DIR, 'tax-assessments.csv')

// This property's town's published single/residential tax rate ($ per $1,000
// of assessed value), by fiscal year. VGSI's "Valuation Year" matches the
// fiscal year directly (no offset) — confirmed by cross-checking the FY2026
// current assessment against the FY2026 rate set by the town's governing
// body in Dec 2025. Source: the town Finance Dept's "FY2018-FY2025 Levy
// Limit & Annual Tax Rate" table, and the FY2026 rate reported by the local
// paper after the Dec 5, 2025 council vote.
const RATE_BY_FISCAL_YEAR = {
  2012: 12.8,
  2013: 13.32,
  2014: 14.16,
  2015: 13.34,
  2016: 13.39,
  2017: 13.45,
  2018: 13.26,
  2019: 13.08,
  2020: 12.84,
  2021: 12.64,
  2022: 12.01,
  2023: 10.74,
  2024: 9.97,
  2025: 9.62,
  2026: 9.26,
}

function parseValuationTable(html, tableId) {
  const tableMatch = html.match(
    new RegExp(`<table[^>]*id="${tableId}".*?</table>`, 's'),
  )
  if (!tableMatch) return []

  const rows = [
    ...tableMatch[0].matchAll(/<tr class="(?:Row|AltRow)Style">(.*?)<\/tr>/gs),
  ]
  return rows.map((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) =>
      c[1].replace(/[^0-9.]/g, ''),
    )
    const [year, building, land, total] = cells
    return {
      fiscalYear: Number(year),
      building: Number(building),
      land: Number(land),
      total: Number(total),
    }
  })
}

async function main() {
  const response = await fetch(PARCEL_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
  }
  const html = await response.text()
  await writeFile(OUT_HTML, html, 'utf-8')
  console.log(`Saved raw HTML to ${OUT_HTML}`)

  const current = parseValuationTable(html, 'MainContent_grdCurrentValueAsmt')
  const history = parseValuationTable(html, 'MainContent_grdHistoryValuesAsmt')

  const byYear = new Map()
  for (const row of [...current, ...history]) byYear.set(row.fiscalYear, row)

  const years = [...byYear.keys()].sort((a, b) => b - a)
  if (years.length === 0) {
    throw new Error(
      'No valuation rows found — VGSI markup may have changed; inspect the saved HTML.',
    )
  }

  const missingRateYears = years.filter((y) => !(y in RATE_BY_FISCAL_YEAR))
  if (missingRateYears.length > 0) {
    console.warn(
      `Warning: no known tax rate for fiscal year(s) ${missingRateYears.join(', ')} — leaving tax_rate/annual_tax blank for those rows.`,
    )
  }

  const header =
    'fiscal_year,land,building,total,tax_rate,annual_tax,source_url'
  const lines = years.map((year) => {
    const row = byYear.get(year)
    const rate = RATE_BY_FISCAL_YEAR[year]
    const annualTax = rate != null ? ((row.total * rate) / 1000).toFixed(2) : ''
    return [
      year,
      row.land,
      row.building,
      row.total,
      rate ?? '',
      annualTax,
      PARCEL_URL,
    ].join(',')
  })

  await writeFile(OUT_CSV, [header, ...lines].join('\n') + '\n', 'utf-8')
  console.log(`Wrote ${lines.length} row(s) to ${OUT_CSV}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
