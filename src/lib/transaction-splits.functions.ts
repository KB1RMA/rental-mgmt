import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { authMiddleware } from '#/lib/auth-middleware'
import { db } from '#/db'
import { transactions } from '#/db/schema'
import { replaceTransactionSplits } from '#/db/repositories/transaction-splits'

const splitsSchema = z.object({
  transactionId: z.string(),
  splits: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        amountCents: z.number().int(),
        notes: z.string().optional(),
      }),
    )
    .refine((splits) => splits.length === 0 || splits.length >= 2, {
      message: 'A split needs at least two line items (or none, to clear it)',
    }),
})

export const saveTransactionSplits = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(splitsSchema)
  .handler(async ({ data }) => {
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, data.transactionId),
    })
    if (!transaction) throw new Error('Transaction not found')

    if (data.splits.length > 0) {
      const sum = data.splits.reduce((total, s) => total + s.amountCents, 0)
      if (sum !== transaction.amountCents) {
        throw new Error(
          `Split amounts must add up to the transaction total (expected ${transaction.amountCents}, got ${sum})`,
        )
      }
    }

    await replaceTransactionSplits(data.transactionId, data.splits)
  })
