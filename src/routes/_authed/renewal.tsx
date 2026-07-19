import { useMemo, useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import {
  getRenewalPageData,
  saveRenewalAssumptions,
} from '#/lib/renewal.functions'
import { parseDollarsToCents } from '#/lib/csv/parse-tax-assessments'
import { computeProjection } from '#/lib/profit/projection'
import { formatCents } from '#/lib/format'
import { cn } from '#/lib/cn'
import { retryOnce } from '#/lib/retry-once'
import { fieldClass } from '#/lib/form-styles'

export const Route = createFileRoute('/_authed/renewal')({
  loader: () => getRenewalPageData(),
  component: RenewalPage,
})

const inputClass = cn(
  'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
  fieldClass,
)

type View = 'cashFlow' | 'operating'

function formatPct(pct: number | null) {
  return pct == null ? '—' : `${pct.toFixed(1)}%`
}

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2)
}

function RenewalPage() {
  const data = Route.useLoaderData()
  const router = useRouter()

  const [view, setView] = useState<View>('cashFlow')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [proposedRent, setProposedRent] = useState(() =>
    data.seeds ? dollarsFromCents(data.seeds.proposedRentCents) : '',
  )
  const [monthlyPrincipal, setMonthlyPrincipal] = useState(() =>
    data.seeds ? dollarsFromCents(data.seeds.monthlyPrincipalCents) : '0',
  )
  const [monthlyExpenseOverride, setMonthlyExpenseOverride] = useState(() =>
    dollarsFromCents(data.assumptions?.monthlyExpenseOverrideCents ?? 0),
  )
  const [notes, setNotes] = useState(data.assumptions?.notes ?? '')

  const projection = useMemo(() => {
    if (!data.lease) return null
    const proposedRentCents = parseDollarsToCents(proposedRent) ?? 0
    const monthlyPrincipalCents = parseDollarsToCents(monthlyPrincipal) ?? 0
    const overrideCents = monthlyExpenseOverride.trim()
      ? parseDollarsToCents(monthlyExpenseOverride)
      : null
    const monthlyExpenseCents = overrideCents ?? data.seeds.monthlyExpenseCents

    return computeProjection({
      proposedRentCents,
      currentRentCents: data.lease.rentCents,
      monthlyExpenseCents,
      monthlyPrincipalCents,
    })
  }, [
    data.lease,
    data.seeds,
    proposedRent,
    monthlyPrincipal,
    monthlyExpenseOverride,
  ])

  if (!data.lease) {
    return <div className="p-8">No active lease found.</div>
  }

  const { lease, pnl, latestAssessment, comparables } = data

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await retryOnce(() =>
        saveRenewalAssumptions({
          data: {
            proposedRent,
            monthlyPrincipal,
            monthlyExpenseOverride,
            notes,
          },
        }),
      )
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const expenseLabel = view === 'cashFlow' ? 'Expenses' : 'Operating expenses'
  const totalUncategorized = pnl.totals.uncategorizedCount

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Renewal dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Since {lease.startDate}
        {lease.tenantNames.length > 0 && ` · ${lease.tenantNames.join(', ')}`}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView('cashFlow')}
          className={cn(
            'border px-3 py-1 text-sm',
            view === 'cashFlow'
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
              : 'border-neutral-300 dark:border-neutral-700',
          )}
        >
          Cash flow
        </button>
        <button
          type="button"
          onClick={() => setView('operating')}
          className={cn(
            'border px-3 py-1 text-sm',
            view === 'operating'
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
              : 'border-neutral-300 dark:border-neutral-700',
          )}
        >
          Operating
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Operating excludes your estimated monthly mortgage principal — the rest
        of the mortgage payment (interest and escrowed property tax) stays in
        either view.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Monthly P&L</h2>
      {totalUncategorized > 0 && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          {totalUncategorized} uncategorized transaction
          {totalUncategorized === 1 ? '' : 's'} excluded — categorize them on
          the Transactions page.
        </p>
      )}
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Month</th>
            <th className="py-2 pr-4 text-right">Income</th>
            <th className="py-2 pr-4 text-right">{expenseLabel}</th>
            <th className="py-2 pr-4 text-right">Net</th>
            <th className="py-2 pr-4 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {pnl.rows.map((row) => (
            <tr
              key={row.period}
              className="border-b border-neutral-100 dark:border-neutral-900"
            >
              <td className="py-2 pr-4">
                {row.period}
                {row.mortgagePaymentCount !== 1 && (
                  <sup className="ml-1 text-neutral-500">
                    {row.mortgagePaymentCount}×mtg
                  </sup>
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(row.incomeCents)}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(
                  view === 'cashFlow'
                    ? row.expenseCents
                    : row.operatingExpenseCents,
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(
                  view === 'cashFlow'
                    ? row.cashFlowNetCents
                    : row.operatingNetCents,
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatPct(
                  view === 'cashFlow'
                    ? row.cashFlowMarginPct
                    : row.operatingMarginPct,
                )}
              </td>
            </tr>
          ))}
          {pnl.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-neutral-500">
                No months in range yet.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200 font-semibold dark:border-neutral-800">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4 text-right">
              {formatCents(pnl.totals.incomeCents)}
            </td>
            <td className="py-2 pr-4 text-right">
              {formatCents(
                view === 'cashFlow'
                  ? pnl.totals.expenseCents
                  : pnl.totals.operatingExpenseCents,
              )}
            </td>
            <td className="py-2 pr-4 text-right">
              {formatCents(
                view === 'cashFlow'
                  ? pnl.totals.cashFlowNetCents
                  : pnl.totals.operatingNetCents,
              )}
            </td>
            <td className="py-2 pr-4 text-right">
              {formatPct(
                view === 'cashFlow'
                  ? pnl.totals.cashFlowMarginPct
                  : pnl.totals.operatingMarginPct,
              )}
            </td>
          </tr>
        </tfoot>
      </table>

      <h2 className="mt-8 text-xl font-semibold">Renewal projection</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Current rent {formatCents(lease.rentCents)}, lease ends {lease.endDate}.
        Expense override left blank uses the trailing actuals average of{' '}
        {formatCents(data.seeds.monthlyExpenseCents)}/mo.
      </p>

      <form
        onSubmit={handleSave}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="proposedRent">
            Proposed rent ($)
          </label>
          <input
            id="proposedRent"
            name="proposedRent"
            type="number"
            step="0.01"
            required
            value={proposedRent}
            onChange={(e) => setProposedRent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium"
            htmlFor="monthlyPrincipal"
          >
            Monthly principal est. ($)
          </label>
          <input
            id="monthlyPrincipal"
            name="monthlyPrincipal"
            type="number"
            step="0.01"
            required
            value={monthlyPrincipal}
            onChange={(e) => setMonthlyPrincipal(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium"
            htmlFor="monthlyExpenseOverride"
          >
            Expense override ($, optional)
          </label>
          <input
            id="monthlyExpenseOverride"
            name="monthlyExpenseOverride"
            type="number"
            step="0.01"
            value={monthlyExpenseOverride}
            onChange={(e) => setMonthlyExpenseOverride(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-sm font-medium" htmlFor="notes">
            Notes
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn('w-full', inputClass)}
          />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {projection && (
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-neutral-500">
              Projected net ({view === 'cashFlow' ? 'cash flow' : 'operating'})
            </dt>
            <dd className="text-lg font-semibold">
              {formatCents(
                view === 'cashFlow'
                  ? projection.cashFlow.netCents
                  : projection.operating.netCents,
              )}
              /mo
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Projected margin</dt>
            <dd className="text-lg font-semibold">
              {formatPct(
                view === 'cashFlow'
                  ? projection.cashFlow.marginPct
                  : projection.operating.marginPct,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Rent increase</dt>
            <dd className="text-lg font-semibold">
              {formatCents(projection.rentIncreaseCents)} (
              {formatPct(projection.rentIncreasePct)})
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">
              Break-even rent ({view === 'cashFlow' ? 'cash flow' : 'operating'}
              )
            </dt>
            <dd className="text-lg font-semibold">
              {formatCents(
                view === 'cashFlow'
                  ? projection.breakEvenRentCents.cashFlow
                  : projection.breakEvenRentCents.operating,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">
              Annualized net (cash flow)
            </dt>
            <dd className="text-lg font-semibold">
              {formatCents(projection.annualCashFlowNetCents)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">
              At current rent ({view === 'cashFlow' ? 'cash flow' : 'operating'}
              )
            </dt>
            <dd className="text-lg font-semibold">
              {formatCents(
                view === 'cashFlow'
                  ? projection.atCurrentRent.cashFlow.netCents
                  : projection.atCurrentRent.operating.netCents,
              )}
              /mo
            </dd>
          </div>
        </dl>
      )}

      {(comparables.length > 0 || latestAssessment) && (
        <div className="mt-8 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Context</h2>
          {latestAssessment && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              FY{latestAssessment.fiscalYear} annual tax{' '}
              {formatCents(latestAssessment.annualTaxCents)} — informational,
              already escrowed in the mortgage payment.
            </p>
          )}
          {comparables.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {comparables.map((c) => (
                <li key={c.id}>
                  {formatCents(c.monthlyRentCents)}/mo
                  {c.address && ` — ${c.address}`}
                  {c.source && ` (${c.source})`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
