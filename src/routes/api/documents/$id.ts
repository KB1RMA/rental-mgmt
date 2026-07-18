import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { auth } from '#/lib/auth'
import { getDocument } from '#/db/repositories/documents'

export const Route = createFileRoute('/api/documents/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const document = await getDocument(params.id)
        if (!document) return new Response('Not found', { status: 404 })

        const object = await env.DOCUMENTS_BUCKET.get(document.r2Key)
        if (!object) return new Response('Not found', { status: 404 })

        return new Response(object.body, {
          headers: {
            'Content-Type': document.mimeType,
            'Content-Disposition': `attachment; filename="${document.filename}"`,
            'Content-Length': String(document.sizeBytes),
            'Cache-Control': 'private, no-store',
          },
        })
      },
    },
  },
})
