/**
 * Retries a server-function call once on a network-level failure
 * (TypeError from a failed fetch), before surfacing the error to the
 * caller. Safe to use with idempotent operations only.
 */
export async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof TypeError) return fn()
    throw err
  }
}
