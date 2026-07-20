import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '#/lib/auth-middleware'
import { listProperties } from '#/db/repositories/properties'

export const getPrimaryPropertyLabel = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const properties = await listProperties()
    return properties.at(0)?.addressLine1 ?? null
  })
