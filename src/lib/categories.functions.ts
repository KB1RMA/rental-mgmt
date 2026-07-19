import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '#/lib/auth-middleware'
import {
  createCategory,
  listCategories,
  updateCategory,
} from '#/db/repositories/categories'
import { categoryTypes, scheduleELines } from '#/db/schema'

export const getCategoriesPageData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const categories = await listCategories()
    return { categories }
  })

const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(categoryTypes),
  scheduleELine: z.enum(scheduleELines).optional().or(z.literal('')),
})

export const createCategoryFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(categoryInputSchema)
  .handler(async ({ data }) => {
    return createCategory({
      name: data.name,
      type: data.type,
      scheduleELine: data.scheduleELine || null,
    })
  })

export const updateCategoryFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(categoryInputSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    return updateCategory(data.id, {
      name: data.name,
      type: data.type,
      scheduleELine: data.scheduleELine || null,
    })
  })
