import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({ component: Dashboard })

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Lease, transactions, and renewal data will show up here.
      </p>
      <Link
        to="/lease"
        className="mt-4 inline-block text-blue-600 underline dark:text-blue-400"
      >
        View lease
      </Link>
    </div>
  )
}
