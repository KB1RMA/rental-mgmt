import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import {
  createTaxAssessment,
  deleteTaxAssessment,
  getTaxAssessmentsPageData,
  importTaxAssessmentsCsv,
} from '#/lib/tax-assessments.functions'
import type { AssessmentImportSummary } from '#/lib/tax-assessments.functions'
import { formatCents } from '#/lib/format'
import { cn } from '#/lib/cn'
import { retryOnce } from '#/lib/retry-once'
import { fieldClass } from '#/lib/form-styles'

export const Route = createFileRoute('/_authed/tax-assessments')({
  loader: () => getTaxAssessmentsPageData(),
  component: TaxAssessmentsPage,
})

const inputClass = cn(
  'mt-1 border border-neutral-300 px-2 py-1 dark:border-neutral-700',
  fieldClass,
)

function TaxAssessmentsPage() {
  const { assessments } = Route.useLoaderData()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AssessmentImportSummary | null>(null)
  const [savingManual, setSavingManual] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setUploadError(null)
    setSummary(null)
    setUploading(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      const result = await retryOnce(() =>
        importTaxAssessmentsCsv({ data: formData }),
      )
      setSummary(result)
      form.reset()
      await router.invalidate()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleManualSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setManualError(null)
    setSavingManual(true)
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      await retryOnce(() =>
        createTaxAssessment({
          data: {
            fiscalYear: String(formData.get('fiscalYear') ?? ''),
            land: String(formData.get('land') ?? ''),
            building: String(formData.get('building') ?? ''),
            total: String(formData.get('total') ?? ''),
            taxRate: String(formData.get('taxRate') ?? ''),
            annualTax: String(formData.get('annualTax') ?? ''),
          },
        }),
      )
      form.reset()
      await router.invalidate()
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingManual(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this assessment year?')) return
    await retryOnce(() => deleteTaxAssessment({ data: { id } }))
    await router.invalidate()
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Tax Assessments</h1>

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
      {uploadError && (
        <p className="mt-2 text-sm text-red-600">{uploadError}</p>
      )}
      {summary && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Imported {summary.imported}, updated {summary.updated}
          {summary.parseErrors.length > 0 &&
            `, ${summary.parseErrors.length} row${summary.parseErrors.length === 1 ? '' : 's'} failed to parse`}
          .
        </p>
      )}
      {summary && summary.parseErrors.length > 0 && (
        <ul className="mt-2 text-sm text-red-600">
          {summary.parseErrors.map((e, i) => (
            <li key={i}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 pr-4">Year</th>
            <th className="py-2 pr-4 text-right">Land</th>
            <th className="py-2 pr-4 text-right">Building</th>
            <th className="py-2 pr-4 text-right">Total</th>
            <th className="py-2 pr-4 text-right">Rate</th>
            <th className="py-2 pr-4 text-right">Annual tax</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((assessment) => (
            <tr
              key={assessment.id}
              className="border-b border-neutral-100 dark:border-neutral-900"
            >
              <td className="py-2 pr-4">{assessment.fiscalYear}</td>
              <td className="py-2 pr-4 text-right">
                {formatCents(assessment.assessedLandCents)}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(assessment.assessedBuildingCents)}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(assessment.assessedTotalCents)}
              </td>
              <td className="py-2 pr-4 text-right">
                {(assessment.taxRateMillsX100 / 100).toFixed(2)}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatCents(assessment.annualTaxCents)}
              </td>
              <td className="py-2 pr-4 text-right">
                <button
                  type="button"
                  onClick={() => handleDelete(assessment.id)}
                  className="text-red-600 underline dark:text-red-400"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {assessments.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-neutral-500">
                No assessments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mt-8 text-xl font-semibold">Add / correct a year</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Total and annual tax are optional — left blank, they're derived from
        land + building and total × rate.
      </p>
      <form
        onSubmit={handleManualSubmit}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="fiscalYear">
            Fiscal year
          </label>
          <input
            id="fiscalYear"
            name="fiscalYear"
            type="number"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="land">
            Land ($)
          </label>
          <input
            id="land"
            name="land"
            type="number"
            step="0.01"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="building">
            Building ($)
          </label>
          <input
            id="building"
            name="building"
            type="number"
            step="0.01"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="total">
            Total ($, optional)
          </label>
          <input
            id="total"
            name="total"
            type="number"
            step="0.01"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="taxRate">
            Tax rate ($/1,000)
          </label>
          <input
            id="taxRate"
            name="taxRate"
            type="number"
            step="0.01"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="annualTax">
            Annual tax ($, optional)
          </label>
          <input
            id="annualTax"
            name="annualTax"
            type="number"
            step="0.01"
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <button
            type="submit"
            disabled={savingManual}
            className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {savingManual ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      {manualError && (
        <p className="mt-2 text-sm text-red-600">{manualError}</p>
      )}
    </div>
  )
}
