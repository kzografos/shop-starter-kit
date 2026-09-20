import { Logger } from '@nestjs/common'

/**
 * Runs best-effort work that belongs *after* a committed transaction: cache
 * invalidation, stock alerts, confirmation mail.
 *
 * Contract (docs/EVENT-REGISTRY.md §1.5 and R7):
 * - The caller's transaction has already committed. Nothing here can undo
 *   it, and nothing here may fail the caller's request: the returned promise
 *   is never awaited and this function never throws or rejects.
 * - A failure is never silent. Rejections and synchronous throws are logged
 *   through the caller's own logger as `<label> failed after commit`, with
 *   the stack, so a missed alert or an invalidation that never ran shows up
 *   where the rest of that service logs.
 * - No retry. Each effect either self-heals (cache TTL, the next stock
 *   change re-derives the alert) or is not idempotent (mail); see R7.
 *
 * `work` starts synchronously, exactly like the bare `promise.catch(() => null)`
 * it replaces, so ordering relative to the caller's remaining statements is
 * unchanged.
 */
export function afterCommit(logger: Logger, label: string, work: () => Promise<unknown>): void {
  new Promise<unknown>((resolve) => resolve(work())).catch((err: unknown) => {
    logger.error(
      `${label} failed after commit: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err.stack : undefined,
    )
  })
}
