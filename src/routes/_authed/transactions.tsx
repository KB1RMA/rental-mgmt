import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import {
  deleteTransaction,
  getTransactionsPageData,
  recategorizeTransaction,
} from '#/lib/transactions.functions'
import { importTransactionsCsv } from '#/lib/transactions-import.functions'
import type { ImportSummary } from '#/lib/transactions-import.functions'
import { saveTransactionSplits } from '#/lib/transaction-splits.functions'
import { formatCents, formatScheduleELine } from '#/lib/format'
import { cn } from '#/lib/cn'
import { retryOnce } from '#/lib/retry-once'
import { fieldClass } from '#/lib/form-styles'
import {
  UNCATEGORIZED_CATEGORY_FILTER,
  transactionIsUncategorized,
  transactionMatchesCategory,
} from '#/lib/transaction-category-filter'

const transactionsSearchSchema = z.object({
  category: z.string().optional(),
})

export const Route = createFileRoute('/_authed/transactions')({
  validateSearch: transactionsSearchSchema,
  loader: () => getTransactionsPageData(),
  component: TransactionsPage,
})

type PageData = Awaited<ReturnType<typeof getTransactionsPageData>>
type TransactionRow = PageData['transactions'][number]
type Category = PageData['categories'][number]

function TransactionsPage() {
  const { transactions, categories } = Route.useLoaderData()
  const { category: rawCategoryFilter = '' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  // A bookmarked or hand-edited URL can carry a `category` value that no
  // longer (or never did) correspond to a real category — fall back to "All
  // categories" rather than filtering by, and rendering a <select> bound to,
  // a value with no matching option.
  const categoryFilter =
    rawCategoryFilter === '' ||
    rawCategoryFilter === UNCATEGORIZED_CATEGORY_FILTER ||
    categories.some((category) => category.id === rawCategoryFilter)
      ? rawCategoryFilter
      : ''

  function setCategoryFilter(value: string) {
    void retryOnce(() =>
      navigate({
        search: (prev) => ({
          ...prev,
          category: value === '' ? undefined : value,
        }),
        replace: true,
      }),
    )
  }

  const filteredTransactions =
    categoryFilter === ''
      ? transactions
      : categoryFilter === UNCATEGORIZED_CATEGORY_FILTER
        ? transactions.filter(transactionIsUncategorized)
        : transactions.filter((transaction) =>
            transactionMatchesCategory(transaction, categoryFilter),
          )

  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSummary(null)
    setUploading(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      const result = await retryOnce(() =>
        importTransactionsCsv({ data: formData }),
      )
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
    await retryOnce(() =>
      recategorizeTransaction({ data: { transactionId, categoryId } }),
    )
    await router.invalidate()
  }

  async function handleSaveSplits(
    transactionId: string,
    splits: { categoryId: string; amountCents: number }[],
  ) {
    await retryOnce(() =>
      saveTransactionSplits({ data: { transactionId, splits } }),
    )
    await router.invalidate()
  }

  async function handleDelete(transactionId: string) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    await retryOnce(() => deleteTransaction({ data: { transactionId } }))
    await router.invalidate()
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Transactions</h1>

      <form onSubmit={handleUpload} className="mt-4 flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="format">
            Source
          </label>
          <select
            id="format"
            name="format"
            defaultValue="property-manager"
            className={cn(
              'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
              fieldClass,
            )}
          >
            <option value="property-manager">Property manager export</option>
            <option value="bank-statement">Bank statement export</option>
          </select>
        </div>
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

      <div className="mt-6">
        <label className="block text-sm font-medium" htmlFor="category-filter">
          Filter by category
        </label>
        <select
          id="category-filter"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className={cn(
            'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
            fieldClass,
          )}
        >
          <option value="">All categories</option>
          <option value={UNCATEGORIZED_CATEGORY_FILTER}>Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4 text-right">Amount</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Schedule E</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categories={categories}
              onRecategorize={handleRecategorize}
              onSaveSplits={handleSaveSplits}
              onDelete={handleDelete}
            />
          ))}
          {filteredTransactions.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-neutral-500">
                {transactions.length === 0
                  ? 'No transactions yet. Import a CSV to get started.'
                  : 'No transactions match this category.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface SplitLine {
  categoryId: string
  amount: string
}

function TransactionRow({
  transaction,
  categories,
  onRecategorize,
  onSaveSplits,
  onDelete,
}: {
  transaction: TransactionRow
  categories: Category[]
  onRecategorize: (transactionId: string, categoryId: string) => Promise<void>
  onSaveSplits: (
    transactionId: string,
    splits: { categoryId: string; amountCents: number }[],
  ) => Promise<void>
  onDelete: (transactionId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState<SplitLine[]>([])
  const [splitError, setSplitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setSplitError(null)
    setLines(
      transaction.splits.length > 0
        ? transaction.splits.map((split) => ({
            categoryId: split.categoryId,
            amount: (split.amountCents / 100).toFixed(2),
          }))
        : [
            {
              categoryId: '',
              amount: (transaction.amountCents / 100).toFixed(2),
            },
            { categoryId: '', amount: '0.00' },
          ],
    )
    setEditing(true)
  }

  function updateLine(index: number, patch: Partial<SplitLine>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    )
  }

  function addLine() {
    setLines((prev) => [...prev, { categoryId: '', amount: '0.00' }])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const lineTotalCents = lines.reduce(
    (sum, line) => sum + Math.round(Number(line.amount || '0') * 100),
    0,
  )
  const targetCents = transaction.amountCents
  const totalsMatch = lineTotalCents === targetCents

  async function handleSave() {
    setSplitError(null)
    if (lines.some((line) => !line.categoryId)) {
      setSplitError('Every line needs a category')
      return
    }
    if (!totalsMatch) {
      setSplitError(
        `Lines total ${formatCents(lineTotalCents)}, but the transaction is ${formatCents(targetCents)}`,
      )
      return
    }
    setSaving(true)
    try {
      await onSaveSplits(
        transaction.id,
        lines.map((line) => ({
          categoryId: line.categoryId,
          amountCents: Math.round(Number(line.amount) * 100),
        })),
      )
      setEditing(false)
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleClearSplits() {
    setSaving(true)
    try {
      await onSaveSplits(transaction.id, [])
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <tr className="border-b border-neutral-100 dark:border-neutral-900">
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
          {transaction.splits.length > 0 && !editing ? (
            <div className="text-xs">
              <ul>
                {transaction.splits.map((split) => (
                  <li key={split.id}>
                    {split.category.name}: {formatCents(split.amountCents)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={startEditing}
                className="mt-1 text-blue-600 underline dark:text-blue-400"
              >
                Edit split
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={transaction.categoryId ?? ''}
                onChange={(event) =>
                  void onRecategorize(transaction.id, event.target.value)
                }
                disabled={editing}
                className={cn(
                  'border px-2 py-1',
                  transaction.categoryId
                    ? 'border-neutral-300 dark:border-neutral-700'
                    : 'border-amber-400 dark:border-amber-600',
                  fieldClass,
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
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-xs text-blue-600 underline dark:text-blue-400"
                >
                  Split
                </button>
              )}
            </div>
          )}
        </td>
        <td className="py-2 pr-4 text-xs text-neutral-600 dark:text-neutral-400">
          {transaction.splits.length > 0 ? (
            <ul>
              {[
                ...new Set(
                  transaction.splits.map((split) =>
                    formatScheduleELine(split.category.scheduleELine),
                  ),
                ),
              ].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            formatScheduleELine(transaction.category?.scheduleELine)
          )}
        </td>
        <td className="py-2 pr-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => void onDelete(transaction.id)}
            className="text-xs text-red-600 underline dark:text-red-400"
          >
            Delete
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-900">
          <td colSpan={6} className="p-3">
            <p className="text-xs text-neutral-500">
              Split {formatCents(targetCents)} into multiple categories
            </p>
            <div className="mt-2 space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={line.categoryId}
                    onChange={(event) =>
                      updateLine(index, { categoryId: event.target.value })
                    }
                    className={cn(
                      'border border-neutral-300 px-2 py-1 dark:border-neutral-700',
                      fieldClass,
                    )}
                  >
                    <option value="" disabled>
                      Choose category
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(index, { amount: event.target.value })
                    }
                    className={cn(
                      'w-28 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
                      fieldClass,
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-xs text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={addLine}
                className="text-xs text-blue-600 underline dark:text-blue-400"
              >
                Add line
              </button>
              <span
                className={cn(
                  'text-xs',
                  totalsMatch
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {formatCents(lineTotalCents)} of {formatCents(targetCents)}
              </span>
            </div>
            {splitError && (
              <p className="mt-1 text-xs text-red-600">{splitError}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700"
              >
                Cancel
              </button>
              {transaction.splits.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearSplits()}
                  className="px-3 py-1 text-xs text-red-600 underline"
                >
                  Clear split
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
