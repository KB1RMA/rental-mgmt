import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { getSession } from '#/lib/get-session'
import BetterAuthHeader from '#/integrations/better-auth/header-user'

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
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <span className="font-semibold">123 Example Street</span>
        <BetterAuthHeader />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
