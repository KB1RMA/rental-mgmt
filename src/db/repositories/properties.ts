import { db } from '#/db'
import { properties } from '#/db/schema'

export type NewProperty = typeof properties.$inferInsert

export function listProperties() {
  return db.query.properties.findMany()
}

export function createProperty(input: NewProperty) {
  return db.insert(properties).values(input).returning().get()
}
