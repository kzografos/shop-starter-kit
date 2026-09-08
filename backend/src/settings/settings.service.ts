import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

/**
 * Settings that price an order. Every one of these is read by OrdersService, so
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

const CACHE_KEY = 'settings:pricing:all'
const CACHE_TTL_S = 60

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

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
    const cached = await this.redis.get(CACHE_KEY)
    if (cached) return JSON.parse(cached) as PricingSettings

    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [...PRICING_SETTING_KEYS] } },
      select: { key: true, value: true },
    })

    const byKey = new Map(rows.map((r) => [r.key, r.value]))
    const missing: string[] = []
    const unparseable: string[] = []
    const result = {} as PricingSettings

    for (const key of PRICING_SETTING_KEYS) {
      const raw = byKey.get(key)
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

    await this.redis.set(CACHE_KEY, JSON.stringify(result), CACHE_TTL_S)
    return result
  }

  /** Called by the admin write path so a settings change is visible immediately. */
  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY)
  }
}
