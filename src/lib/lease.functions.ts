import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '#/lib/auth-middleware'
import { getActiveLease } from '#/db/repositories/leases'

export const getActiveLeaseData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    return getActiveLease()
  })
