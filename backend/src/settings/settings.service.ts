import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import type { SettingDefinition } from './setting-definition'

const CACHE_KEY = 'settings:all'
const CACHE_TTL_S = 60

/**
 * Generic key/value settings store (Core).
 *
 * Knows nothing about what a key means. Modules register the keys they own
 * with define(); Core stores the values, caches them briefly, exposes them
 * to module services through getAll(), and lets the admin panel read and
 * write the registered keys. What a value means — and whether a missing one
 * is a fault — is decided by the module that registered it (e.g. the orders
 * module's PricingSettingsService).
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)
  private readonly registry = new Map<string, SettingDefinition>()

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Registry ────────────────────────────────────────────────

  /**
   * Registers settings a module owns. Called from the module's onModuleInit.
   * A key registered twice is a wiring error and fails boot.
   */
  define(definitions: readonly SettingDefinition[]): void {
    for (const def of definitions) {
      if (this.registry.has(def.key)) {
        throw new Error(`Setting "${def.key}" is already registered`)
      }
      this.registry.set(def.key, def)
    }
  }

  /** Registered definitions, in registration order. */
  definitions(): SettingDefinition[] {
    return [...this.registry.values()]
  }

  // ── Values ──────────────────────────────────────────────────

  /**
   * Every stored row as a key → raw string map. Cached briefly; the admin
   * write path invalidates it so a change is visible immediately.
   */
  async getAll(): Promise<Record<string, string>> {
    const cached = await this.redis.get(CACHE_KEY)
    if (cached) return JSON.parse(cached) as Record<string, string>

    const rows = await this.prisma.setting.findMany({ select: { key: true, value: true } })
    const result = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    await this.redis.set(CACHE_KEY, JSON.stringify(result), CACHE_TTL_S)
    return result
  }

  /** Called by the admin write path so a settings change is visible immediately. */
  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY)
  }

  // ── Admin read/write ────────────────────────────────────────

  /** Every row as a key → raw string value map, for the admin settings form. */
  async getAdminSettings() {
    const rows = await this.prisma.setting.findMany()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  /**
   * Writes the registered keys present in the body; unknown keys are ignored.
   * Number settings must parse and be non-negative.
   */
  async updateAdminSettings(body: Record<string, unknown>) {
    const entries = Object.entries(body).filter(([k]) => this.registry.has(k))
    for (const [key, value] of entries) {
      const def = this.registry.get(key)!
      let stored: string
      if (def.type === 'number') {
        const num = Number(value)
        if (Number.isNaN(num) || num < 0)
          throw new BadRequestException(`Invalid value for ${key}`)
        stored = String(num)
      } else {
        stored = String(value)
      }
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: stored },
        create: { key, value: stored },
      })
    }
    // Module services read through getAll(), which caches. Without this the
    // checkout would price against stale values for up to a minute after the
    // owner saves.
    await this.invalidate()
    return this.getAdminSettings()
  }
}
