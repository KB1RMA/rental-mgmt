import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { leases, units, leaseTenants } from '#/db/schema'

export type NewUnit = typeof units.$inferInsert
export type NewLease = typeof leases.$inferInsert
export type NewLeaseTenant = typeof leaseTenants.$inferInsert

export function createUnit(input: NewUnit) {
  return db.insert(units).values(input).returning().get()
}

export function createLease(input: NewLease) {
  return db.insert(leases).values(input).returning().get()
}

export function addLeaseTenant(input: NewLeaseTenant) {
  return db.insert(leaseTenants).values(input).returning().get()
}

export function getActiveLease() {
  return db.query.leases.findFirst({
    where: eq(leases.status, 'active'),
    with: {
      unit: { with: { property: true } },
      leaseTenants: { with: { tenant: true } },
      documents: true,
    },
  })
}
