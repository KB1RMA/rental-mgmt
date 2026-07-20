import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import {
  createCategoryFn,
  getCategoriesPageData,
  updateCategoryFn,
} from '#/lib/categories.functions'
import { categoryTypes, scheduleELines } from '#/db/schema'
import { formatScheduleELine } from '#/lib/format'
import { cn } from '#/lib/cn'
import { retryOnce } from '#/lib/retry-once'
import { fieldClass } from '#/lib/form-styles'

export const Route = createFileRoute('/_authed/categories')({
  loader: () => getCategoriesPageData(),
  component: CategoriesPage,
})

type PageData = Awaited<ReturnType<typeof getCategoriesPageData>>
type Category = PageData['categories'][number]

const inputClass = cn(
  'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
  fieldClass,
)

function CategoriesPage() {
  const { categories } = Route.useLoaderData()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setCreating(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      await retryOnce(() =>
        createCategoryFn({
          data: {
            name: String(formData.get('name') ?? ''),
            type: String(
              formData.get('type') ?? 'expense',
            ) as (typeof categoryTypes)[number],
            scheduleELine: String(formData.get('scheduleELine') ?? '') as
              (typeof scheduleELines)[number] | '',
          },
        }),
      )
      form.reset()
      await router.invalidate()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Categories</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Categories used across transactions, splits, and the renewal dashboard.
        Schedule E line controls how expenses are grouped for tax reporting.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Schedule E line</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-neutral-500">
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mt-8 text-xl font-semibold">Add a category</h2>
      <form
        onSubmit={handleCreate}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue="expense"
            className={inputClass}
          >
            {categoryTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="scheduleELine">
            Schedule E line (optional)
          </label>
          <select
            id="scheduleELine"
            name="scheduleELine"
            defaultValue=""
            className={inputClass}
          >
            <option value="">—</option>
            {scheduleELines.map((line) => (
              <option key={line} value={line}>
                {formatScheduleELine(line)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <button
            type="submit"
            disabled={creating}
            className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {creating ? 'Saving…' : 'Add category'}
          </button>
        </div>
      </form>
      {createError && (
        <p className="mt-2 text-sm text-red-600">{createError}</p>
      )}
    </div>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [type, setType] = useState(category.type)
  const [scheduleELine, setScheduleELine] = useState<
    (typeof scheduleELines)[number] | ''
  >(category.scheduleELine ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEditing() {
    setError(null)
    setName(category.name)
    setType(category.type)
    setScheduleELine(category.scheduleELine ?? '')
    setEditing(true)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await retryOnce(() =>
        updateCategoryFn({
          data: { id: category.id, name, type, scheduleELine },
        }),
      )
      setEditing(false)
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <tr className="border-b border-neutral-100 dark:border-neutral-900">
        <td className="py-2 pr-4">{category.name}</td>
        <td className="py-2 pr-4">{category.type}</td>
        <td className="py-2 pr-4">
          {formatScheduleELine(category.scheduleELine)}
        </td>
        <td className="py-2 pr-4 text-right">
          <button
            type="button"
            onClick={startEditing}
            className="text-blue-600 underline dark:text-blue-400"
          >
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-900">
      <td className="py-2 pr-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={cn(
            'border border-neutral-300 px-2 py-1 dark:border-neutral-700',
            fieldClass,
          )}
        />
      </td>
      <td className="py-2 pr-4">
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as typeof category.type)
          }
          className={cn(
            'border border-neutral-300 px-2 py-1 dark:border-neutral-700',
            fieldClass,
          )}
        >
          {categoryTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4">
        <select
          value={scheduleELine}
          onChange={(event) =>
            setScheduleELine(
              event.target.value as (typeof scheduleELines)[number] | '',
            )
          }
          className={cn(
            'border border-neutral-300 px-2 py-1 dark:border-neutral-700',
            fieldClass,
          )}
        >
          <option value="">—</option>
          {scheduleELines.map((line) => (
            <option key={line} value={line}>
              {formatScheduleELine(line)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mr-3 text-blue-600 underline disabled:opacity-50 dark:text-blue-400"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
        >
          Cancel
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  )
}
