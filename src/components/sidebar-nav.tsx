import { useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  FileText,
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  TrendingUp,
} from 'lucide-react'

import { cn } from '#/lib/cn'

const STORAGE_KEY = 'sidebar-collapsed'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lease', label: 'Lease', icon: FileText },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/tax-assessments', label: 'Tax Assessments', icon: Landmark },
  { to: '/renewal', label: 'Renewal', icon: TrendingUp },
] as const

export default function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-950',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-neutral-200 px-3 dark:border-neutral-800',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && (
          <span className="truncate text-sm font-semibold">
            123 Example Street
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
                collapsed && 'justify-center',
                isActive &&
                  'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
