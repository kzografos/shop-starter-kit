import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'
import { PRICING_SETTINGS, PRICING_SETTING_KEYS, type PricingSettings } from './pricing-settings'

/**
 * Typed, validated view of the pricing settings. Owned by the orders domain;
 * Core's SettingsService only stores the rows.
 */
@Injectable()
export class PricingSettingsService implements OnModuleInit {
  private readonly logger = new Logger(PricingSettingsService.name)

  constructor(private settings: SettingsService) {}

  onModuleInit() {
    this.settings.define(PRICING_SETTINGS)
  }

  /**
   * Loads every pricing setting, failing loudly if one is missing or unparseable.
   *
   * Previously OrdersService did `parseFloat(row.value)` into a plain object and
   * read keys off it. A missing row yielded undefined, parseFloat(undefined) is
   * NaN, and the NaN propagated silently into subtotal, shipping and total -- an
   * order could be written with a NaN total. Blowing up here is strictly better
   * than persisting that.
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
      this.logger.error(`Pricing settings are incomplete (${parts.join('; ')}). Run the seed.`)
      throw new InternalServerErrorException(
        'Store pricing is not configured. Please contact the store.',
      )
    }

    return result
  }
}
