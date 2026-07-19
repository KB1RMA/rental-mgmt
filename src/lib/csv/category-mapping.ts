const EXACT_MAP: Record<string, string> = {
  'Income|Rents': 'Rent Income',
  'Repairs & Maintenance|Appliance Repairs': 'Repairs',
  'Repairs & Maintenance|Painting': 'Repairs',
  'Repairs & Maintenance|Plumbing Repairs': 'Repairs',
  'Repairs & Maintenance|Snow Removal': 'Repairs',
  'Utilities|Water & Sewer': 'Utilities',
  'Mortgages & Loans|Mortgage Payment': 'Mortgage Interest',
  'Admin & Other|HOA Dues': 'Other Expenses',
  'Transfers|Owner Distributions': 'Owner Distributions',
}

const CATEGORY_ONLY_MAP: Record<string, string> = {
  Income: 'Rent Income',
  'Repairs & Maintenance': 'Repairs',
  Utilities: 'Utilities',
  'Mortgages & Loans': 'Mortgage Interest',
  'Admin & Other': 'Other Expenses',
  'Security Deposits': 'Security Deposits',
  Transfers: 'Owner Distributions',
}

/**
 * Maps a source CSV's own Category/Sub-Category to one of our seeded
 * category names, or null if the source file left it blank/unrecognized
 * (falls through to the rules engine, then manual review).
 */
export function mapSourceCategory(
  sourceCategory: string,
  sourceSubCategory: string,
): string | null {
  if (!sourceCategory) return null

  const exact = EXACT_MAP[`${sourceCategory}|${sourceSubCategory}`]
  if (exact) return exact

  return CATEGORY_ONLY_MAP[sourceCategory] ?? null
}
