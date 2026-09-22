/**
 * The two role values Core itself stores in `users.role` (lowercase text).
 *
 * Owned by `users` because they are what the user row holds: `MEMBER_ROLE`
 * is written on registration, `OWNER_ROLE` is the account that may do
 * anything. What a role *permits* is `auth`'s concern
 * (`auth/permissions.ts`, which re-exports these so its importers see one
 * vocabulary); every other staff role is a preset a module registers.
 *
 * `auth` depends on `users` (authentication looks users up); `users` does
 * not depend on `auth` at runtime — this file is what keeps it that way.
 */

/** The role that bypasses every check and may sign into the admin panel unconditionally. */
export const OWNER_ROLE = 'admin'

/** The default, non-staff role every account holds unless promoted. */
export const MEMBER_ROLE = 'customer'
