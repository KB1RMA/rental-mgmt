import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '#/lib/auth-middleware'
import { listCategories } from '#/db/repositories/categories'
import {
  deleteTransactionById,
  listTransactionsWithCategory,
  updateTransactionCategory,
} from '#/db/repositories/transactions'

export const getTransactionsPageData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const [transactions, categories] = await Promise.all([
      listTransactionsWithCategory(),
      listCategories(),
    ])
    return { transactions, categories }
  })

export const recategorizeTransaction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ transactionId: z.string(), categoryId: z.string() }))
  .handler(async ({ data }) => {
    return updateTransactionCategory(data.transactionId, data.categoryId)
  })

export const deleteTransaction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ transactionId: z.string() }))
  .handler(async ({ data }) => {
    await deleteTransactionById(data.transactionId)
  })
