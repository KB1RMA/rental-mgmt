import { createServerFn } from '@tanstack/react-start'

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
  getRentChargeForPeriod,
  listRentChargesForLease,
  rentPaymentExistsForTransaction,
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
