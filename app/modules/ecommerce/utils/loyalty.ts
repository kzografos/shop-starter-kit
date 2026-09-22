import type { Profile } from '~~/types'
import type { LoyaltyProfileExtension } from '#shop/types'

/**
 * The loyalty balance carried on a profile payload by the loyalty module's
 * user extension (`backend/src/loyalty/loyalty-user.extension.ts`, wire key
 * `loyalty_points`). Shop-owned: Core's `Profile` and auth store know nothing
 * about it. A profile without the field (module absent, guest, not loaded)
 * reads as 0 — the same fallback the auth store used to apply.
 */
export function loyaltyPointsOf(profile: (Profile & Partial<LoyaltyProfileExtension>) | null | undefined): number {
  const points = profile?.loyalty_points
  return typeof points === 'number' && Number.isFinite(points) ? points : 0
}
