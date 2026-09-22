import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import type { SettingDefinition, SettingGroupDefinition } from './setting-definition'

const CACHE_KEY = 'settings:all'
const CACHE_TTL_S = 60

/** What the admin form receives: the registry plus the current values. */
export interface AdminSettingsPayload {
  groups: SettingGroupDefinition[]
  definitions: SettingDefinition[]
  /** Stored value, or the default when no row exists, per registered key. */
  values: Record<string, string>
}

/**
 * Generic key/value settings store (Core) behind the Settings Registry.
 *
 * Knows nothing about what a key means. Modules register the keys and groups
 * they own with define()/defineGroups(); Core stores the values, applies the
 * registered defaults where a row is missing, caches briefly, validates the
 * admin write path against the definition, and serves the `public` subset.
 * What a value means is decided by the module that registered it (e.g. the
 * orders module's PricingSettingsService).
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)
  private readonly registry = new Map<string, SettingDefinition>()
  private readonly groups = new Map<string, SettingGroupDefinition>()

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Registry ────────────────────────────────────────────────

  /**
   * Registers settings a module owns. Called from the module's onModuleInit.
   * A definition that is incomplete, whose default does not fit its own
   * type/constraints, or whose key is already taken is a wiring error and
   * fails boot — a module cannot ship a setting the store could not serve.
   */
  define(definitions: readonly SettingDefinition[]): void {
    for (const def of definitions) {
      const problem = validateDefinition(def)
      if (problem) throw new Error(`Setting "${def?.key ?? '?'}" is invalid: ${problem}`)
      if (this.registry.has(def.key)) throw new Error(`Setting "${def.key}" is already registered`)
      this.registry.set(def.key, def)
    }
  }

  /** Registers the form groups a module's settings belong to. Duplicate ids fail boot. */
  defineGroups(groups: readonly SettingGroupDefinition[]): void {
    for (const g of groups) {
      if (!g?.id || !g.labelKey || typeof g.order !== 'number') throw new Error(`Setting group "${g?.id ?? '?'}" is invalid: id, labelKey and order are required`)
      if (this.groups.has(g.id)) throw new Error(`Setting group "${g.id}" is already registered`)
      this.groups.set(g.id, g)
    }
  }

  /** Registered definitions, by group order then field order. */
  definitions(): SettingDefinition[] {
    const groupOrder = (id: string) => this.groups.get(id)?.order ?? Number.MAX_SAFE_INTEGER
    return [...this.registry.values()].sort(
      (a, b) => groupOrder(a.group) - groupOrder(b.group) || (a.order ?? 0) - (b.order ?? 0) || a.key.localeCompare(b.key),
    )
  }

  /** Registered groups, by order. */
  groupDefinitions(): SettingGroupDefinition[] {
    return [...this.groups.values()].sort((a, b) => a.order - b.order)
  }

  private defaults(): Record<string, string> {
    return Object.fromEntries([...this.registry.values()].map((d) => [d.key, d.default]))
  }

  // ── Values ──────────────────────────────────────────────────

  /**
   * Every registered key → raw string value: the stored row, or the
   * registered default when no row exists. Rows for unregistered keys are
   * kept too (a module may be temporarily disabled). Cached briefly; the
   * admin write path invalidates it so a change is visible immediately.
   */
  async getAll(): Promise<Record<string, string>> {
    const cached = await this.redis.get(CACHE_KEY)
    if (cached) return { ...this.defaults(), ...(JSON.parse(cached) as Record<string, string>) }

    const rows = await this.prisma.setting.findMany({ select: { key: true, value: true } })
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    await this.redis.set(CACHE_KEY, JSON.stringify(stored), CACHE_TTL_S)
    return { ...this.defaults(), ...stored }
  }

  /** Called by the admin write path so a settings change is visible immediately. */
  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY)
  }

  /**
   * The settings marked `public`, parsed to their type. The only read that
   * leaves the backend without a guard; anything not marked public never
   * appears here, whatever is stored.
   */
  async getPublic(): Promise<Record<string, number | string>> {
    const all = await this.getAll()
    const out: Record<string, number | string> = {}
    for (const def of this.definitions()) {
      if (!def.public) continue
      const raw = all[def.key] ?? def.default
      if (def.type !== 'number') { out[def.key] = raw; continue }
      // A hand-edited, non-numeric row must not reach the storefront as null.
      const n = Number(raw)
      out[def.key] = Number.isFinite(n) ? n : Number(def.default)
    }
    return out
  }

  // ── Admin read/write ────────────────────────────────────────

  /** The registry and the current value (stored or default) of every registered key. */
  async getAdminSettings(): Promise<AdminSettingsPayload> {
    const rows = await this.prisma.setting.findMany({ select: { key: true, value: true } })
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const definitions = this.definitions()
    return {
      groups: this.groupDefinitions(),
      definitions,
      values: Object.fromEntries(definitions.map((d) => [d.key, stored[d.key] ?? d.default])),
    }
  }

  /**
   * Writes the registered, editable keys present in the body; unknown keys
   * are ignored, a non-editable key is refused, and every value is checked
   * against its definition (type, min, max) before anything is stored.
   */
  async updateAdminSettings(body: Record<string, unknown>): Promise<AdminSettingsPayload> {
    const writes: [string, string][] = []
    for (const [key, value] of Object.entries(body ?? {})) {
      const def = this.registry.get(key)
      if (!def) continue
      if (def.editable === false) throw new BadRequestException(`${key} is not editable`)
      writes.push([key, coerce(def, value)])
    }
    for (const [key, stored] of writes) {
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

/** Stored form of an incoming value, or a 400 naming the key. */
function coerce(def: SettingDefinition, value: unknown): string {
  if (def.type === 'number') {
    const num = typeof value === 'number' ? value : Number(String(value).trim())
    if (String(value).trim() === '' || !Number.isFinite(num)) throw new BadRequestException(`Invalid value for ${def.key}`)
    if (def.min !== undefined && num < def.min) throw new BadRequestException(`${def.key} must be at least ${def.min}`)
    if (def.max !== undefined && num > def.max) throw new BadRequestException(`${def.key} must be at most ${def.max}`)
    return String(num)
  }
  if (typeof value !== 'string') throw new BadRequestException(`Invalid value for ${def.key}`)
  return value
}

/** Why a definition cannot be registered, or null when it is sound. */
export function validateDefinition(def: SettingDefinition | null | undefined): string | null {
  if (!def || typeof def !== 'object') return 'not an object'
  for (const field of ['key', 'group', 'labelKey', 'default'] as const) {
    if (typeof def[field] !== 'string' || def[field].length === 0) return `${field} is required`
  }
  if (def.type !== 'number' && def.type !== 'string') return `type must be number or string`
  if (def.type === 'number') {
    const n = Number(def.default)
    if (!Number.isFinite(n)) return `default "${def.default}" is not a number`
    if (def.min !== undefined && n < def.min) return `default ${n} is below min ${def.min}`
    if (def.max !== undefined && n > def.max) return `default ${n} is above max ${def.max}`
    if (def.min !== undefined && def.max !== undefined && def.min > def.max) return `min ${def.min} exceeds max ${def.max}`
  }
  return null
}
