import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { CORE_CAPABILITIES, CORE_CAPABILITIES_ORDER, OWNER_ROLE, type Capability } from './permissions'

/**
 * Permission Registry (blueprint §7.1).
 *
 * Modules contribute, Core reads: each module registers the capabilities it
 * owns and the staff-role presets it defines from its onModuleInit; the guard
 * and the profile endpoint read the merged result at request time.
 *
 * Duplicate registration is a wiring error and fails boot immediately. A
 * preset may name a capability another module registers later, so preset →
 * capability consistency is checked once every module has initialised
 * (onApplicationBootstrap) and fails boot if a preset references a capability
 * nobody registered.
 */
@Injectable()
export class PermissionsRegistryService implements OnApplicationBootstrap {
  // id → { order, seq }: `order` is the contributor's position in the merged
  // list, `seq` the registration index that breaks ties, so the merged list is
  // deterministic regardless of the order modules happen to initialise in.
  private readonly capabilities = new Map<Capability, { order: number; seq: number }>()
  private readonly presets = new Map<string, Capability[]>()
  private seq = 0

  constructor() {
    this.defineCapabilities(CORE_CAPABILITIES, { order: CORE_CAPABILITIES_ORDER })
  }

  // ── Contributions ─────────────────────────────────────────────

  /**
   * @param opts.order position of this contribution in the merged capability
   *   list (lower first). Defaults after Core's own capabilities.
   */
  defineCapabilities(ids: readonly Capability[], opts: { order?: number } = {}): void {
    const order = opts.order ?? CORE_CAPABILITIES_ORDER + 1
    for (const id of ids) {
      if (this.capabilities.has(id)) throw new Error(`Capability "${id}" is already registered`)
      this.capabilities.set(id, { order, seq: this.seq++ })
    }
  }

  /** Role names are the lowercase values stored in `users.role`, as seen on req.user.role. */
  defineRolePreset(role: string, caps: readonly Capability[]): void {
    if (role === OWNER_ROLE) throw new Error(`Role "${OWNER_ROLE}" is the owner and holds every capability; it cannot be redefined`)
    if (this.presets.has(role)) throw new Error(`Role preset "${role}" is already registered`)
    this.presets.set(role, [...caps])
  }

  /** Fails boot if a preset references a capability no module registered. */
  onApplicationBootstrap(): void {
    this.validate()
  }

  validate(): void {
    for (const [role, caps] of this.presets) {
      for (const cap of caps) {
        if (!this.capabilities.has(cap)) {
          throw new Error(`Role preset "${role}" references unregistered capability "${cap}"`)
        }
      }
    }
  }

  // ── Reads ─────────────────────────────────────────────────────

  /** Every registered capability, sorted by contribution order, then registration order. */
  allCapabilities(): Capability[] {
    return [...this.capabilities.entries()]
      .sort((a, b) => a[1].order - b[1].order || a[1].seq - b[1].seq)
      .map(([id]) => id)
  }

  permissionsFor(role: string | undefined | null): Capability[] {
    if (!role) return []
    if (role === OWNER_ROLE) return this.allCapabilities()
    return [...(this.presets.get(role) ?? [])]
  }

  /** Roles that may sign into the admin panel: the owner plus every registered preset. */
  staffRoles(): string[] {
    return [OWNER_ROLE, ...this.presets.keys()]
  }
}
