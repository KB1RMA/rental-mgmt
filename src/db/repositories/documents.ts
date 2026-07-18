import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { documents } from '#/db/schema'

export type NewDocument = typeof documents.$inferInsert

export function createDocument(input: NewDocument) {
  return db.insert(documents).values(input).returning().get()
}

export function getDocument(id: string) {
  return db.query.documents.findFirst({ where: eq(documents.id, id) })
}

export function listDocumentsForLease(leaseId: string) {
  return db.query.documents.findMany({
    where: eq(documents.leaseId, leaseId),
  })
}
