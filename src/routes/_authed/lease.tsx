import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getActiveLeaseData } from '#/lib/lease.functions'
import { uploadDocument } from '#/lib/documents.functions'
import { documentKinds } from '#/db/schema'
import { formatCents } from '#/lib/format'
import { syncAndGetRentLedger } from '#/lib/rent-ledger.functions'
import { cn } from '#/lib/cn'
import { fieldClass } from '#/lib/form-styles'

export const Route = createFileRoute('/_authed/lease')({
  loader: async () => {
    const [lease, rentLedger] = await Promise.all([
      getActiveLeaseData(),
      syncAndGetRentLedger(),
    ])
    return { lease, rentLedger }
  },
  component: LeasePage,
})

const statusStyles: Record<string, string> = {
  paid: 'text-green-700 dark:text-green-400',
  partial: 'text-amber-600 dark:text-amber-400',
  due: 'text-neutral-600 dark:text-neutral-400',
  late: 'text-red-600 dark:text-red-400',
}

function renewalNoticeDeadline(endDate: string, noticeDays: number) {
  const deadline = new Date(`${endDate}T00:00:00Z`)
  deadline.setUTCDate(deadline.getUTCDate() - noticeDays)
  return deadline.toISOString().slice(0, 10)
}

function LeasePage() {
  const { lease, rentLedger } = Route.useLoaderData()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!lease) {
    return <div className="p-8">No active lease found.</div>
  }

  const tenantNames = lease.leaseTenants.map((lt) => lt.tenant.name).join(', ')

  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lease) return
    setError(null)
    setUploading(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('leaseId', lease.id)
    formData.set('propertyId', lease.unit.property.id)
    try {
      await uploadDocument({ data: formData })
      form.reset()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">{lease.unit.property.name}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        {lease.unit.property.addressLine1}, {lease.unit.property.city},{' '}
        {lease.unit.property.state} {lease.unit.property.zip}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-neutral-500">Tenant</dt>
          <dd>{tenantNames}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Monthly rent</dt>
          <dd>{formatCents(lease.rentCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Lease term</dt>
          <dd>
            {lease.startDate} – {lease.endDate}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Security deposit</dt>
          <dd>{formatCents(lease.securityDepositCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Late fee</dt>
          <dd>
            {formatCents(lease.lateFeeCents)} after {lease.lateFeeGraceDays}{' '}
            days
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Renewal notice deadline</dt>
          <dd className="font-semibold">
            {renewalNoticeDeadline(lease.endDate, lease.noticeDays)}
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 text-xl font-semibold">Rent ledger</h2>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Period</th>
            <th className="py-2 pr-4">Due date</th>
            <th className="py-2 pr-4 text-right">Amount</th>
            <th className="py-2 pr-4 text-right">Paid</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(rentLedger ?? []).map((charge) => {
            const paidCents = charge.rentPayments.reduce(
              (sum, payment) => sum + payment.amountCents,
              0,
            )
            return (
              <tr
                key={charge.id}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className="py-2 pr-4">{charge.period}</td>
                <td className="py-2 pr-4">{charge.dueDate}</td>
                <td className="py-2 pr-4 text-right">
                  {formatCents(charge.amountCents)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {formatCents(paidCents)}
                </td>
                <td
                  className={cn(
                    'py-2 pr-4 capitalize',
                    statusStyles[charge.status],
                  )}
                >
                  {charge.status}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 className="mt-8 text-xl font-semibold">Documents</h2>
      <ul className="mt-2 space-y-1">
        {lease.documents.map((doc) => (
          <li key={doc.id}>
            <a
              className="text-blue-600 underline dark:text-blue-400"
              href={`/api/documents/${doc.id}`}
            >
              {doc.filename}
            </a>
          </li>
        ))}
        {lease.documents.length === 0 && (
          <p className="text-neutral-500">No documents yet.</p>
        )}
      </ul>

      <form onSubmit={handleUpload} className="mt-4 flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="kind">
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue="lease"
            className={cn(
              'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
              fieldClass,
            )}
          >
            {documentKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="file">
            File
          </label>
          <input id="file" name="file" type="file" required className="mt-1" />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
