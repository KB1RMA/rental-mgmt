import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { test as base, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

const execFileAsync = promisify(execFile)

const resetSqlPath = fileURLToPath(new URL('./reset-data.sql', import.meta.url))

// Browser errors that mean the page a test is driving isn't the page React
// thinks it is — e.g. a hydration mismatch makes React throw away the
// server HTML and re-render on the client, so a click that lands in between
// hits a dead node and the test fails somewhere unrelated much later.
const FATAL_CONSOLE_PATTERNS = [/Hydration failed/i, /hydrat.*mismatch/i]

interface ServerFnTracker {
  inFlight: number
  lastActivity: number
}

const serverFnTrackers = new WeakMap<Page, ServerFnTracker>()

const SERVER_FN_PREFIX = '/_serverFn/'

function isServerFnRequest(request: Request) {
  return new URL(request.url()).pathname.startsWith(SERVER_FN_PREFIX)
}

// Server-function URLs are base64url-encoded {file, export} JSON — decode
// them so a failure names the function rather than an opaque id.
function describeServerFn(request: Request) {
  const id = new URL(request.url()).pathname.slice(SERVER_FN_PREFIX.length)
  try {
    const { export: name } = JSON.parse(
      Buffer.from(id, 'base64url').toString(),
    ) as { export?: string }
    if (name) return name.replace(/_createServerFn_handler$/, '')
  } catch {
    // Fall through to the raw id.
  }
  return id
}

// Set E2E_SERVER_FN_DELAY_MS (e.g. 500) to slow every server-function call
// and flush out tests that race a mutation — they pass on a fast machine
// and flake on a loaded CI runner.
const serverFnDelayMs = Number(process.env.E2E_SERVER_FN_DELAY_MS ?? 0)

export const test = base.extend<{
  resetData: void
  browserGuard: void
}>({
  // Every test starts from the seeded baseline, so no test depends on what
  // an earlier one left behind, and a CI retry of a test that got partway
  // through (e.g. already imported its CSV) starts clean instead of
  // tripping over its own previous attempt. Always --local: this must never
  // touch the remote database.
  resetData: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here
    async ({}, use) => {
      await execFileAsync('npx', [
        'wrangler',
        'd1',
        'execute',
        'rental-mgmt-db',
        '--local',
        `--file=${resetSqlPath}`,
      ])
      await use()
    },
    { auto: true },
  ],

  browserGuard: [
    async ({ page }, use) => {
      const problems: string[] = []
      const tracker: ServerFnTracker = { inFlight: 0, lastActivity: 0 }
      serverFnTrackers.set(page, tracker)
      if (serverFnDelayMs > 0) {
        await page.route(`**${SERVER_FN_PREFIX}**`, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, serverFnDelayMs))
          await route.fallback()
        })
      }

      const settle = (request: Request) => {
        if (!isServerFnRequest(request)) return
        tracker.inFlight -= 1
        tracker.lastActivity = Date.now()
      }
      page.on('request', (request) => {
        if (!isServerFnRequest(request)) return
        tracker.inFlight += 1
        tracker.lastActivity = Date.now()
      })
      page.on('requestfinished', settle)
      page.on('requestfailed', (request) => {
        settle(request)
        // An aborted write means the test navigated or reloaded while a
        // mutation was still in flight: the app sees "TypeError: Failed to
        // fetch" and whether the write landed is a race. Wait for the UI to
        // confirm the mutation (or call waitForServerFnsIdle) first. Aborted
        // reads (e.g. router.invalidate()'s refetch) are harmless.
        if (isServerFnRequest(request) && request.method() !== 'GET') {
          problems.push(
            `aborted server-function write: ${request.method()} ${describeServerFn(request)} (${request.failure()?.errorText ?? 'unknown'})`,
          )
        }
      })
      page.on('pageerror', (error) => {
        problems.push(`pageerror: ${error.stack ?? error.message}`)
      })
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text()
        if (FATAL_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
          problems.push(`console.error: ${text}`)
        }
      })

      await use()

      if (problems.length > 0) {
        throw new Error(
          `Browser reported ${problems.length} problem(s) during this test:\n\n${problems.join('\n\n')}`,
        )
      }
    },
    { auto: true },
  ],
})

export { expect }

// Runs `action` (a click, a selectOption, …) and resolves once the
// server-function write it triggers has responded successfully. Use it for
// mutations with no UI confirmation to assert on before moving on.
export async function withServerFnWrite(
  page: Page,
  action: () => Promise<unknown>,
) {
  const response = page.waitForResponse(
    (candidate) =>
      isServerFnRequest(candidate.request()) &&
      candidate.request().method() !== 'GET',
  )
  await action()
  expect((await response).ok()).toBe(true)
}

// For when a mutation has no UI signal to await before navigating away.
// Prefer asserting on the UI's own confirmation where there is one.
export async function waitForServerFnsIdle(page: Page, quietMs = 250) {
  const tracker = serverFnTrackers.get(page)
  if (!tracker) throw new Error('Page is not tracked by the browserGuard')
  await expect
    .poll(
      () =>
        tracker.inFlight <= 0 && Date.now() - tracker.lastActivity >= quietMs,
      { intervals: [50] },
    )
    .toBe(true)
}

// SSR'd HTML is visible (and passes read-only assertions) before React has
// attached handlers, so any interaction must wait for hydration first.
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
}

export async function gotoHydrated(page: Page, url: string) {
  await waitForServerFnsIdle(page)
  await page.goto(url)
  await waitForHydration(page)
}

export async function reloadHydrated(page: Page) {
  await waitForServerFnsIdle(page)
  await page.reload()
  await waitForHydration(page)
}

export async function signIn(page: Page) {
  await gotoHydrated(page, '/login')
  await page.getByLabel('Email').fill('e2e-test@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  await waitForHydration(page)
}
