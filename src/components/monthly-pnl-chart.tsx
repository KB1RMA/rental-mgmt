import type { CSSProperties } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

import type { MonthlyPnlRow } from '#/lib/profit/monthly-pnl'
import { formatCents } from '#/lib/format'

export interface MonthlyPnlChartProps {
  rows: MonthlyPnlRow[]
  view: 'cashFlow' | 'operating'
}

function formatAxisDollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  return (
    <div className="border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <p className="font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-3"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {formatCents(Number(entry.value ?? 0))}
          </span>
          <span className="text-neutral-500">{entry.name}</span>
        </p>
      ))}
    </div>
  )
}

export function MonthlyPnlChart({ rows, view }: MonthlyPnlChartProps) {
  const data = rows.map((row) => ({
    period: row.period,
    income: row.incomeCents,
    expense: view === 'cashFlow' ? row.expenseCents : row.operatingExpenseCents,
    net: view === 'cashFlow' ? row.cashFlowNetCents : row.operatingNetCents,
  }))

  return (
    <div
      className="pnl-chart h-72 w-full"
      style={
        {
          '--pnl-income': '#2a78d6',
          '--pnl-expense': '#1baf7a',
          '--pnl-net': '#eda100',
          '--pnl-grid': '#e1e0d9',
          '--pnl-axis': '#898781',
        } as CSSProperties
      }
    >
      <style>{`
        @media (prefers-color-scheme: dark) {
          .pnl-chart {
            --pnl-income: #3987e5;
            --pnl-expense: #199e70;
            --pnl-net: #c98500;
            --pnl-grid: #2c2c2a;
            --pnl-axis: #898781;
          }
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <CartesianGrid
            stroke="var(--pnl-grid)"
            vertical={false}
            strokeWidth={1}
          />
          <XAxis
            dataKey="period"
            tick={{ fill: 'var(--pnl-axis)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--pnl-axis)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--pnl-axis)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAxisDollars}
            width={64}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: 'transparent' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--pnl-income)"
            radius={[4, 4, 0, 0]}
            barSize={18}
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill="var(--pnl-expense)"
            radius={[4, 4, 0, 0]}
            barSize={18}
          />
          <Line
            dataKey="net"
            name="Net"
            stroke="var(--pnl-net)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--pnl-net)' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
