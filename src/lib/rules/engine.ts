export interface CategorizationRule {
  priority: number
  field: 'description' | 'merchant'
  matchType: 'contains' | 'exact' | 'regex'
  pattern: string
  amountMinCents: number | null
  amountMaxCents: number | null
  categoryId: string
  active: boolean
}

export interface MatchInput {
  description: string
  merchant?: string | null
  amountCents: number
}

export function matchCategorizationRule(
  rules: CategorizationRule[],
  input: MatchInput,
): string | null {
  const sorted = [...rules]
    .filter((rule) => rule.active)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of sorted) {
    if (rule.amountMinCents != null && input.amountCents < rule.amountMinCents)
      continue
    if (rule.amountMaxCents != null && input.amountCents > rule.amountMaxCents)
      continue

    const fieldValue =
      (rule.field === 'merchant' ? input.merchant : input.description) ?? ''

    if (matchesPattern(fieldValue, rule.matchType, rule.pattern)) {
      return rule.categoryId
    }
  }
  return null
}

function matchesPattern(
  value: string,
  matchType: CategorizationRule['matchType'],
  pattern: string,
): boolean {
  switch (matchType) {
    case 'contains':
      return value.toLowerCase().includes(pattern.toLowerCase())
    case 'exact':
      return value.toLowerCase() === pattern.toLowerCase()
    case 'regex':
      try {
        return new RegExp(pattern, 'i').test(value)
      } catch {
        return false
      }
  }
}
