import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '#/lib/auth-middleware'
import { parseDollarsToCents } from '#/lib/csv/parse-tax-assessments'
import {
  averageMonthlyExpenseCents,
  computeMonthlyPnl,
} from '#/lib/profit/monthly-pnl'
import { listProperties } from '#/db/repositories/properties'
import { getActiveLease } from '#/db/repositories/leases'
import { listTransactionsWithCategory } from '#/db/repositories/transactions'
import {
  getRenewalAssumptionsForProperty,
  upsertRenewalAssumptions,
} from '#/db/repositories/renewal-assumptions'
import { listComparableRentsForProperty } from '#/db/repositories/comparable-rents'
import { listTaxAssessmentsForProperty } from '#/db/repositories/tax-assessments'

async function getCurrentProperty() {
  const properties = await listProperties()
  const property = properties.at(0)
  if (!property) throw new Error('No property configured yet')
  return property
}

export const getRenewalPageData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const property = await getCurrentProperty()
    const lease = await getActiveLease()

    if (!lease) {
      return {
        lease: null,
        pnl: null,
        assumptions: null,
        seeds: null,
        comparables: [],
        latestAssessment: null,
      } as const
    }

    const [transactions, assumptions, comparables, assessments] =
      await Promise.all([
        listTransactionsWithCategory(),
        getRenewalAssumptionsForProperty(property.id),
        listComparableRentsForProperty(property.id),
        listTaxAssessmentsForProperty(property.id),
      ])

    const today = new Date().toISOString().slice(0, 10)
    const pnl = computeMonthlyPnl({
      transactions,
      startPeriod: lease.startDate.slice(0, 7),
      endPeriod: today.slice(0, 7),
      monthlyPrincipalCents: assumptions?.monthlyPrincipalCents ?? 0,
    })

    const seeds = {
      proposedRentCents: assumptions?.proposedRentCents ?? lease.rentCents,
      monthlyPrincipalCents: assumptions?.monthlyPrincipalCents ?? 0,
      monthlyExpenseCents:
        assumptions?.monthlyExpenseOverrideCents ??
        averageMonthlyExpenseCents(pnl.rows),
    }

    return {
      lease: {
        rentCents: lease.rentCents,
        startDate: lease.startDate,
        endDate: lease.endDate,
        tenantNames: lease.leaseTenants.map((lt) => lt.tenant.name),
      },
      pnl,
      assumptions,
      seeds,
      comparables,
      latestAssessment: assessments.at(0) ?? null,
    } as const
  })

const assumptionsSchema = z.object({
  proposedRent: z.string(),
  monthlyPrincipal: z.string(),
  monthlyExpenseOverride: z.string().optional(),
  notes: z.string().optional(),
})

export const saveRenewalAssumptions = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(assumptionsSchema)
  .handler(async ({ data }) => {
    const property = await getCurrentProperty()

    const proposedRentCents = parseDollarsToCents(data.proposedRent)
    if (proposedRentCents == null) {
      throw new Error(`Invalid proposed rent: ${data.proposedRent}`)
    }

    const monthlyPrincipalCents = parseDollarsToCents(data.monthlyPrincipal)
    if (monthlyPrincipalCents == null) {
      throw new Error(`Invalid monthly principal: ${data.monthlyPrincipal}`)
    }

    const monthlyExpenseOverrideCents = data.monthlyExpenseOverride?.trim()
      ? parseDollarsToCents(data.monthlyExpenseOverride)
      : null
    if (
      data.monthlyExpenseOverride?.trim() &&
      monthlyExpenseOverrideCents == null
    ) {
      throw new Error(
        `Invalid monthly expense override: ${data.monthlyExpenseOverride}`,
      )
    }

    return upsertRenewalAssumptions({
      propertyId: property.id,
      proposedRentCents,
      monthlyPrincipalCents,
      monthlyExpenseOverrideCents,
      notes: data.notes?.trim() || null,
    })
  })
