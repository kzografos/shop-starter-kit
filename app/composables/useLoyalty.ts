import { loyaltyPointsOf } from '~/utils/loyalty'

/**
 * Shop-owned view of the signed-in customer's loyalty balance. Reads the
 * `loyalty_points` user extension off the Core profile; Core itself does not
 * name the field (docs/MODULE-REGISTRY.md §3.4, seam 2).
 */
export function useLoyalty() {
  const { profile } = storeToRefs(useAuthStore())
  const points = computed(() => loyaltyPointsOf(profile.value))
  return { points }
}
