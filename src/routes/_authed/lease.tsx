import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { getActiveLeaseData } from '#/lib/lease.functions'
import { uploadDocument } from '#/lib/documents.functions'
import { documentKinds } from '#/db/schema'
import { formatCents } from '#/lib/format'
import {
  addManualRentPayment,
  deleteRentPayment,
  syncAndGetRentLedger,
  updateRentChargeAmount,
} from '#/lib/rent-ledger.functions'
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

type RentLedger = NonNullable<Awaited<ReturnType<typeof syncAndGetRentLedger>>>
type RentCharge = RentLedger[number]

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
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {(rentLedger ?? []).map((charge) => (
            <RentLedgerRow
              key={charge.id}
              charge={charge}
              onInvalidate={() => router.invalidate()}
            />
          ))}
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

function RentLedgerRow({
  charge,
  onInvalidate,
}: {
  charge: RentCharge
  onInvalidate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState((charge.amountCents / 100).toFixed(2))
  const [paymentDate, setPaymentDate] = useState(charge.dueDate)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paidCents = charge.rentPayments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  )

  async function handleSaveAmount() {
    setError(null)
    setSaving(true)
    try {
      await updateRentChargeAmount({
        data: {
          chargeId: charge.id,
          amountCents: Math.round(Number(amount) * 100),
        },
      })
      onInvalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save amount')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPayment() {
    setError(null)
    if (!paymentAmount || Number(paymentAmount) === 0) {
      setError('Enter a payment amount')
      return
    }
    setSaving(true)
    try {
      await addManualRentPayment({
        data: {
          rentChargeId: charge.id,
          paidDate: paymentDate,
          amountCents: Math.round(Number(paymentAmount) * 100),
        },
      })
      setPaymentAmount('')
      onInvalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setSaving(true)
    try {
      await deleteRentPayment({ data: { paymentId } })
      onInvalidate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <tr className="border-b border-neutral-100 dark:border-neutral-900">
        <td className="py-2 pr-4">{charge.period}</td>
        <td className="py-2 pr-4">{charge.dueDate}</td>
        <td className="py-2 pr-4 text-right">
          {formatCents(charge.amountCents)}
        </td>
        <td className="py-2 pr-4 text-right">{formatCents(paidCents)}</td>
        <td className={cn('py-2 pr-4 capitalize', statusStyles[charge.status])}>
          {charge.status}
        </td>
        <td className="py-2 pr-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="text-xs text-blue-600 underline dark:text-blue-400"
          >
            {open ? 'Close' : 'Reconcile'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-900">
          <td colSpan={6} className="p-3">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="block text-xs text-neutral-500">
                  Expected amount
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className={cn(
                      'w-28 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
                      fieldClass,
                    )}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveAmount()}
                    className="text-xs text-blue-600 underline disabled:opacity-50 dark:text-blue-400"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Override for a prorated first/last month.
                </p>
              </div>

              <div>
                <label className="block text-xs text-neutral-500">
                  Record a payment
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className={cn(
                      'border border-neutral-300 px-2 py-1 dark:border-neutral-700',
                      fieldClass,
                    )}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className={cn(
                      'w-24 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
                      fieldClass,
                    )}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleAddPayment()}
                    className="text-xs text-blue-600 underline disabled:opacity-50 dark:text-blue-400"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  For payments not auto-matched from a transaction — e.g. a
                  lump-sum deposit split across categories.
                </p>
              </div>
            </div>

            {charge.rentPayments.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {charge.rentPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-2">
                    <span>
                      {payment.paidDate} — {formatCents(payment.amountCents)}{' '}
                      <span className="text-neutral-500">
                        ({payment.transactionId ? 'from transaction' : 'manual'}
                        )
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeletePayment(payment.id)}
                      className="text-red-600 underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}
