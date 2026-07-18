import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { authMiddleware } from '#/lib/auth-middleware'
import { createDocument } from '#/db/repositories/documents'
import { documentKinds } from '#/db/schema'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function parseUploadForm(data: unknown) {
  if (!(data instanceof FormData)) throw new Error('Expected FormData')

  const file = data.get('file')
  const kind = data.get('kind')
  const leaseId = data.get('leaseId')
  const propertyId = data.get('propertyId')

  if (!(file instanceof File) || file.size === 0) {
    throw new Error('A file is required')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 25MB limit')
  }
  if (
    typeof kind !== 'string' ||
    !documentKinds.includes(kind as (typeof documentKinds)[number])
  ) {
    throw new Error('Invalid document kind')
  }

  return {
    file,
    kind: kind as (typeof documentKinds)[number],
    leaseId: typeof leaseId === 'string' ? leaseId : undefined,
    propertyId: typeof propertyId === 'string' ? propertyId : undefined,
  }
}

export const uploadDocument = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(parseUploadForm)
  .handler(async ({ data }) => {
    const r2Key = `documents/${crypto.randomUUID()}-${data.file.name}`
    await env.DOCUMENTS_BUCKET.put(r2Key, await data.file.arrayBuffer(), {
      httpMetadata: {
        contentType: data.file.type || 'application/octet-stream',
      },
    })

    return createDocument({
      kind: data.kind,
      r2Key,
      filename: data.file.name,
      mimeType: data.file.type || 'application/octet-stream',
      sizeBytes: data.file.size,
      leaseId: data.leaseId,
      propertyId: data.propertyId,
    })
  })
