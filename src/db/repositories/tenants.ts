import { db } from '#/db'
import { tenants } from '#/db/schema'

export type NewTenant = typeof tenants.$inferInsert

export function listTenants() {
  return db.query.tenants.findMany()
}

export function createTenant(input: NewTenant) {
  return db.insert(tenants).values(input).returning().get()
}
