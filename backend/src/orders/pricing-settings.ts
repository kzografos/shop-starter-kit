import type { SettingDefinition } from '../settings/setting-definition'

/**
 * Settings that price an order. Owned by the orders domain; registered with
 * Core's SettingsService at boot (PricingSettingsService), which is what lets
 * the admin panel write them. Every one of these is read by OrdersService, so
 * a missing row is a fault rather than a default -- see loadPricing().
 */
export const PRICING_SETTING_KEYS = [
  'shipping_cost',
  'free_shipping_threshold',
  'loyalty_earn_rate',
  'loyalty_redeem_rate',
  'loyalty_min_redeem',
] as const

export type PricingSettingKey = (typeof PRICING_SETTING_KEYS)[number]
export type PricingSettings = Record<PricingSettingKey, number>

export const PRICING_SETTINGS: readonly SettingDefinition[] = PRICING_SETTING_KEYS.map((key) => ({
  key,
  type: 'number' as const,
}))
