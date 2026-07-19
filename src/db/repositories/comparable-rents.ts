import { desc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { comparableRents } from '#/db/schema'

export function listComparableRentsForProperty(propertyId: string) {
  return db.query.comparableRents.findMany({
    where: eq(comparableRents.propertyId, propertyId),
    orderBy: desc(comparableRents.notedAt),
  })
}
