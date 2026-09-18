import type { SettingDefinition, SettingGroupDefinition } from '../settings/setting-definition'

/**
 * Settings that price an order. Owned by the orders domain; registered with
 * Core's SettingsService at boot (PricingSettingsService), which is what lets
 * the admin form render and write them and the public read serve them. The
 * defaults here are the only place they are defined: a fresh installation
 * prices with them until the owner saves the form (no seed rows needed).
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

export const PRICING_SETTING_GROUPS: readonly SettingGroupDefinition[] = [
  { id: 'shipping', labelKey: 'admin.shipping_settings', descriptionKey: 'admin.shipping_settings_sub', icon: 'cart', order: 10 },
  { id: 'loyalty', labelKey: 'admin.loyalty_settings', descriptionKey: 'admin.loyalty_settings_sub', icon: 'star', order: 20 },
]

// Every pricing value is shown to the customer (shipping banner, loyalty
// card, checkout total), so all of them are public.
export const PRICING_SETTINGS: readonly SettingDefinition[] = [
  { key: 'shipping_cost', type: 'number', default: '5.00', group: 'shipping', labelKey: 'admin.shipping_cost', order: 10, public: true, min: 0, step: 0.01, unit: '€' },
  { key: 'free_shipping_threshold', type: 'number', default: '50.00', group: 'shipping', labelKey: 'admin.free_shipping_threshold', order: 20, public: true, min: 0, step: 0.01, unit: '€' },
  { key: 'loyalty_earn_rate', type: 'number', default: '100', group: 'loyalty', labelKey: 'admin.loyalty_earn_rate', descriptionKey: 'admin.loyalty_earn_hint', order: 10, public: true, min: 0, step: 1 },
  // The redeem rate divides the discount; 0 would divide by zero.
  { key: 'loyalty_redeem_rate', type: 'number', default: '100', group: 'loyalty', labelKey: 'admin.loyalty_redeem_rate', descriptionKey: 'admin.loyalty_redeem_hint', order: 20, public: true, min: 1, step: 1 },
  { key: 'loyalty_min_redeem', type: 'number', default: '500', group: 'loyalty', labelKey: 'admin.loyalty_min_redeem', descriptionKey: 'admin.loyalty_min_hint', order: 30, public: true, min: 0, step: 1 },
]
