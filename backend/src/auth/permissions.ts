/**
 * Capability-based access control for the admin panel — Core vocabulary.
 *
 * Roles map to a strict set of capabilities. The OWNER (ADMIN) implicitly
 * holds every capability; other staff roles see only what they're granted.
 * Enforced server-side by PermissionsGuard — never trust hidden menus alone.
 *
 * Core owns the mechanism (PermissionsRegistryService, PermissionsGuard,
 * RequirePermissions) and only the capabilities below. Every other capability
 * and every non-owner staff role is registered by the module that owns it
 * (e.g. products/catalog-permissions.ts, orders/orders-permissions.ts).
 */

/** A capability id, `verb:noun` (verbs `view` | `manage`). */
export type Capability = string

/** The role that bypasses every check and may sign into the admin panel unconditionally. */
export const OWNER_ROLE = 'ADMIN'

/**
 * Position of a contribution in the merged capability list (what the owner
 * sees and what /profile returns). Lower comes first; ties keep registration
 * order. Modules pick their own number; Core's own capabilities come last.
 */
export const CORE_CAPABILITIES_ORDER = 40

/** Capabilities for Core's own admin surfaces, in display order. */
export const CORE_CAPABILITIES: readonly Capability[] = [
  'view:customers',
  'manage:marketing', // newsletter
  'manage:settings',
  'manage:staff', // staff accounts + roles
]
