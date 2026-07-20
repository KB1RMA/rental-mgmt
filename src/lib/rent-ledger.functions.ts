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
  listRentChargesForLease,
  rentPaymentExistsForTransaction,
  updateRentChargeAmount as setRentChargeAmount,
  updateRentChargeStatus,
} from '#/db/repositories/rent'
import { getCategoryByName } from '#/db/repositories/categories'
import { listTransactionsByCategory } from '#/db/repositories/transactions'

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
 * Records a payment against a charge without requiring a matching bank
 * transaction — for cases like a lump-sum move-in payment that was split
 * across categories and so isn't visible to the auto-sync's category match.
 */
export const addManualRentPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      rentChargeId: z.string(),
      paidDate: z.string(),
      amountCents: z.number().int(),
    }),
  )
  .handler(async ({ data }) => {
    await createRentPayment({
      rentChargeId: data.rentChargeId,
      paidDate: data.paidDate,
      amountCents: data.amountCents,
      method: 'manual',
    })
  })

export const deleteRentPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ paymentId: z.string() }))
  .handler(async ({ data }) => {
    await deleteRentPaymentRow(data.paymentId)
  })
