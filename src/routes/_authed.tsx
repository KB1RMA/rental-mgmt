import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { getSession } from '#/lib/get-session'
import { getPrimaryPropertyLabel } from '#/lib/property.functions'
import BetterAuthHeader from '#/integrations/better-auth/header-user'
import SidebarNav from '#/components/sidebar-nav'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { session }
  },
  loader: async () => {
    const propertyLabel = await getPrimaryPropertyLabel()
    return { propertyLabel }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { propertyLabel } = Route.useLoaderData()
  return (
    <div className="flex min-h-screen">
      <SidebarNav propertyLabel={propertyLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-neutral-200 px-6 dark:border-neutral-800">
          <BetterAuthHeader />
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
