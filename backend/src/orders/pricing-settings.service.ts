import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'
import { PRICING_SETTINGS, PRICING_SETTING_GROUPS, PRICING_SETTING_KEYS, type PricingSettings } from './pricing-settings'

/**
 * Typed, validated view of the pricing settings. Owned by the orders domain;
 * Core's SettingsService only stores the rows.
 */
@Injectable()
export class PricingSettingsService implements OnModuleInit {
  private readonly logger = new Logger(PricingSettingsService.name)

  constructor(private settings: SettingsService) {}

  onModuleInit() {
    this.settings.defineGroups(PRICING_SETTING_GROUPS)
    this.settings.define(PRICING_SETTINGS)
  }

  /**
   * Loads every pricing setting, failing loudly if one is unparseable.
   *
   * A missing row is no longer possible: SettingsService.getAll() applies the
   * registered default. A stored value that is not a number (a hand edit)
   * still fails here rather than letting NaN reach subtotal, shipping and
   * total -- an order must never be written with a NaN total.
   */
  async loadPricing(): Promise<PricingSettings> {
    const all = await this.settings.getAll()

    const missing: string[] = []
    const unparseable: string[] = []
    const result = {} as PricingSettings

    for (const key of PRICING_SETTING_KEYS) {
      const raw = all[key]
      if (raw === undefined) {
        missing.push(key)
        continue
      }
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        unparseable.push(`${key}="${raw}"`)
        continue
      }
      result[key] = parsed
    }

    if (missing.length || unparseable.length) {
      const parts = [
        missing.length ? `missing: ${missing.join(', ')}` : '',
        unparseable.length ? `not numeric: ${unparseable.join(', ')}` : '',
      ].filter(Boolean)
      this.logger.error(`Pricing settings are incomplete (${parts.join('; ')}). Fix the rows in the settings table.`)
      throw new InternalServerErrorException(
        'Store pricing is not configured. Please contact the store.',
      )
    }

    return result
  }
}
