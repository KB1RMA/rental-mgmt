import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import {
  getTransactionsPageData,
  recategorizeTransaction,
} from '#/lib/transactions.functions'
import { importTransactionsCsv } from '#/lib/transactions-import.functions'
import type { ImportSummary } from '#/lib/transactions-import.functions'
import { formatCents } from '#/lib/format'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/_authed/transactions')({
  loader: () => getTransactionsPageData(),
  component: TransactionsPage,
})

// The CSV upload is a large, cold-loaded server function bundle; a transient
// "Failed to fetch" on the first hit is a real (if rare) possibility on any
// network, so retry once before surfacing an error to the user.
async function importWithRetry(formData: FormData): Promise<ImportSummary> {
  try {
    return await importTransactionsCsv({ data: formData })
  } catch (err) {
    if (err instanceof TypeError) {
      return importTransactionsCsv({ data: formData })
    }
    throw err
  }
}

function TransactionsPage() {
  const { transactions, categories } = Route.useLoaderData()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSummary(null)
    setUploading(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      const result = await importWithRetry(formData)
      setSummary(result)
      form.reset()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRecategorize(transactionId: string, categoryId: string) {
    await recategorizeTransaction({ data: { transactionId, categoryId } })
    await router.invalidate()
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Transactions</h1>

      <form onSubmit={handleUpload} className="mt-4 flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="file">
            Import CSV
          </label>
          <input id="file" name="file" type="file" required className="mt-1" />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {uploading ? 'Importing…' : 'Import'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {summary && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Imported {summary.imported}, skipped {summary.duplicates} duplicate
          {summary.duplicates === 1 ? '' : 's'}, {summary.uncategorized} need
          {summary.uncategorized === 1 ? 's' : ''} a category.
        </p>
      )}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4 text-right">Amount</th>
            <th className="py-2 pr-4">Category</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className="border-b border-neutral-100 dark:border-neutral-900"
            >
              <td className="py-2 pr-4 whitespace-nowrap">
                {transaction.postedDate}
              </td>
              <td className="py-2 pr-4">{transaction.description}</td>
              <td
                className={cn(
                  'py-2 pr-4 text-right whitespace-nowrap',
                  transaction.amountCents < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400',
                )}
              >
                {formatCents(transaction.amountCents)}
              </td>
              <td className="py-2 pr-4">
                <select
                  value={transaction.categoryId ?? ''}
                  onChange={(event) =>
                    void handleRecategorize(transaction.id, event.target.value)
                  }
                  className={cn(
                    'border px-2 py-1',
                    transaction.categoryId
                      ? 'border-neutral-300 dark:border-neutral-700'
                      : 'border-amber-400 dark:border-amber-600',
                  )}
                >
                  <option value="" disabled>
                    Uncategorized
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-neutral-500">
                No transactions yet. Import a CSV to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
