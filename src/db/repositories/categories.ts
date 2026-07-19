import { asc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { categories, categorizationRules } from '#/db/schema'

export function listCategories() {
  return db.query.categories.findMany({ orderBy: asc(categories.name) })
}

export function getCategoryByName(name: string) {
  return db.query.categories.findFirst({ where: eq(categories.name, name) })
}

export function listActiveCategorizationRules() {
  return db.query.categorizationRules.findMany({
    where: eq(categorizationRules.active, true),
    orderBy: asc(categorizationRules.priority),
  })
}

export type NewCategorizationRule = typeof categorizationRules.$inferInsert

export function createCategorizationRule(input: NewCategorizationRule) {
  return db.insert(categorizationRules).values(input).returning().get()
}

export type NewCategory = typeof categories.$inferInsert

export function createCategory(input: NewCategory) {
  return db.insert(categories).values(input).returning().get()
}

export function updateCategory(
  id: string,
  input: Partial<Pick<NewCategory, 'name' | 'type' | 'scheduleELine'>>,
) {
  return db
    .update(categories)
    .set(input)
    .where(eq(categories.id, id))
    .returning()
    .get()
}
