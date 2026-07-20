import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '#/lib/auth-middleware'
import {
  generateChargePeriods,
  periodForPaymentDate,
  computeChargeStatus,
} from '#/lib/rent/ledger'
import { getActiveLease } from '#/db/repositories/leases'
import {
  createRentCharge,
  createRentPayment,
  deleteRentPayment as deleteRentPaymentRow,
  getRentChargeForPeriod,
  listLinkedTransactionRefs,
  listRentChargesForLease,
  rentPaymentExistsForTransaction,
  updateRentChargeAmount as setRentChargeAmount,
  updateRentChargeStatus,
} from '#/db/repositories/rent'
import { getCategoryByName } from '#/db/repositories/categories'
import {
  getTransactionById,
  getTransactionSplitById,
  listTransactionsByCategory,
  listTransactionsForProperty,
  updateTransactionCategory,
} from '#/db/repositories/transactions'

export const syncAndGetRentLedger = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    const lease = await getActiveLease()
    if (!lease) return null

    const today = new Date().toISOString().slice(0, 10)
    const periods = generateChargePeriods(
      lease.startDate,
      lease.endDate,
      lease.rentDueDay,
      today,
    )

    for (const { period, dueDate } of periods) {
      const existing = await getRentChargeForPeriod(lease.id, period)
      if (!existing) {
        await createRentCharge({
          leaseId: lease.id,
          period,
          dueDate,
          amountCents: lease.rentCents,
          status: 'due',
        })
      }
    }

    const rentIncomeCategory = await getCategoryByName('Rent Income')
    if (rentIncomeCategory) {
      const propertyId = lease.unit.property.id
      const rentTransactions = await listTransactionsByCategory(
        propertyId,
        rentIncomeCategory.id,
      )

      for (const transaction of rentTransactions) {
        if (await rentPaymentExistsForTransaction(transaction.id)) continue

        const period = periodForPaymentDate(transaction.postedDate)
        const charge = await getRentChargeForPeriod(lease.id, period)
        if (!charge) continue

        await createRentPayment({
          rentChargeId: charge.id,
          transactionId: transaction.id,
          paidDate: transaction.postedDate,
          amountCents: transaction.amountCents,
        })
      }
    }

    const charges = await listRentChargesForLease(lease.id)
    for (const charge of charges) {
      const paidCents = charge.rentPayments.reduce(
        (sum, payment) => sum + payment.amountCents,
        0,
      )
      const status = computeChargeStatus(
        charge.amountCents,
        paidCents,
        charge.dueDate,
        lease.lateFeeGraceDays,
        today,
      )
      if (status !== charge.status) {
        await updateRentChargeStatus(charge.id, status)
      }
    }

    return listRentChargesForLease(lease.id)
  })

/**
 * Overrides a charge's expected amount — needed for a prorated first/last
 * month, where the flat lease rent doesn't match what was actually owed.
 */
export const updateRentChargeAmount = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({ chargeId: z.string(), amountCents: z.number().int().min(0) }),
  )
  .handler(async ({ data }) => {
    await setRentChargeAmount(data.chargeId, data.amountCents)
  })

/**
 * Transactions/splits for the property not yet linked to any rent payment —
 * the pool of candidates the reconcile UI picks from, so a payment is always
 * tied to a real bank transaction rather than a typed-in amount. A split
 * transaction (e.g. a move-in payment covering rent + deposit) offers its
 * individual split lines instead of the whole transaction, since only one
 * line is the actual rent portion.
 */
export const listRentPaymentCandidates = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const lease = await getActiveLease()
    if (!lease) return []

    const [transactionList, linked] = await Promise.all([
      listTransactionsForProperty(lease.unit.property.id),
      listLinkedTransactionRefs(),
    ])

    const candidates: Array<{
      transactionId: string
      splitId: string | null
      postedDate: string
      amountCents: number
      description: string
      categoryName: string | null
    }> = []

    for (const transaction of transactionList) {
      if (transaction.splits.length > 0) {
        for (const split of transaction.splits) {
          if (linked.splitIds.has(split.id)) continue
          candidates.push({
            transactionId: transaction.id,
            splitId: split.id,
            postedDate: transaction.postedDate,
            amountCents: split.amountCents,
            description: transaction.merchant ?? transaction.description,
            categoryName: split.category.name,
          })
        }
      } else {
        if (linked.transactionIds.has(transaction.id)) continue
        candidates.push({
          transactionId: transaction.id,
          splitId: null,
          postedDate: transaction.postedDate,
          amountCents: transaction.amountCents,
          description: transaction.merchant ?? transaction.description,
          categoryName: transaction.category?.name ?? null,
        })
      }
    }

    return candidates
  })

/**
 * Links a rent charge to a real transaction (or one split line of a split
 * transaction) picked from `listRentPaymentCandidates` — amount and date are
 * always derived server-side from the transaction, never taken from the
 * client, so the ledger can't drift from the bank record.
 *
 * Reports (monthly P&L, Schedule E) classify income/expense purely from
 * `categories.type` on the transaction, not from rent_payments — so an
 * uncategorized transaction linked here would show as "paid" in the ledger
 * but invisible in every report. A split's category was already chosen
 * deliberately when the split was created, so it's left alone; a whole,
 * still-uncategorized transaction is categorized as Rent Income so the two
 * views of the same payment stay consistent.
 */
export const addRentPaymentFromTransaction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      rentChargeId: z.string(),
      transactionId: z.string(),
      splitId: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const transaction = await getTransactionById(data.transactionId)
    if (!transaction) throw new Error('Transaction not found')

    if (data.splitId) {
      const split = await getTransactionSplitById(data.splitId)
      if (!split || split.transactionId !== data.transactionId) {
        throw new Error('Transaction split not found')
      }
      await createRentPayment({
        rentChargeId: data.rentChargeId,
        transactionId: data.transactionId,
        transactionSplitId: data.splitId,
        paidDate: transaction.postedDate,
        amountCents: split.amountCents,
        method: 'matched',
      })
    } else {
      if (transaction.categoryId == null) {
        const rentIncomeCategory = await getCategoryByName('Rent Income')
        if (rentIncomeCategory) {
          await updateTransactionCategory(transaction.id, rentIncomeCategory.id)
        }
      }
      await createRentPayment({
        rentChargeId: data.rentChargeId,
        transactionId: data.transactionId,
        paidDate: transaction.postedDate,
        amountCents: transaction.amountCents,
        method: 'matched',
      })
    }
  })

export const deleteRentPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ paymentId: z.string() }))
  .handler(async ({ data }) => {
    await deleteRentPaymentRow(data.paymentId)
  })
