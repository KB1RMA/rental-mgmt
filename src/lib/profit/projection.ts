export interface ProjectionInputs {
  proposedRentCents: number
  currentRentCents: number
  monthlyExpenseCents: number
  monthlyPrincipalCents: number
}

export interface ProjectionView {
  netCents: number
  marginPct: number | null
}

export interface ProjectionResult {
  cashFlow: ProjectionView
  operating: ProjectionView
  atCurrentRent: { cashFlow: ProjectionView; operating: ProjectionView }
  rentIncreaseCents: number
  rentIncreasePct: number | null
  breakEvenRentCents: { cashFlow: number; operating: number }
  annualCashFlowNetCents: number
}

function marginPct(netCents: number, rentCents: number): number | null {
  if (rentCents === 0) return null
  return (netCents / rentCents) * 100
}

function view(rentCents: number, expenseCents: number): ProjectionView {
  const netCents = rentCents - expenseCents
  return { netCents, marginPct: marginPct(netCents, rentCents) }
}

export function computeProjection(inputs: ProjectionInputs): ProjectionResult {
  const {
    proposedRentCents,
    currentRentCents,
    monthlyExpenseCents,
    monthlyPrincipalCents,
  } = inputs

  const operatingExpenseCents = Math.max(
    0,
    monthlyExpenseCents - monthlyPrincipalCents,
  )

  const cashFlow = view(proposedRentCents, monthlyExpenseCents)
  const operating = view(proposedRentCents, operatingExpenseCents)

  const atCurrentRent = {
    cashFlow: view(currentRentCents, monthlyExpenseCents),
    operating: view(currentRentCents, operatingExpenseCents),
  }

  const rentIncreaseCents = proposedRentCents - currentRentCents
  const rentIncreasePct =
    currentRentCents === 0 ? null : (rentIncreaseCents / currentRentCents) * 100

  return {
    cashFlow,
    operating,
    atCurrentRent,
    rentIncreaseCents,
    rentIncreasePct,
    breakEvenRentCents: {
      cashFlow: monthlyExpenseCents,
      operating: operatingExpenseCents,
    },
    annualCashFlowNetCents: cashFlow.netCents * 12,
  }
}
