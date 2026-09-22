import { Injectable } from '@nestjs/common'

/**
 * Where a user object is about to leave Core for the client. Extensions opt
 * into the surfaces they belong on: the loyalty balance appears on both, the
 * admin-only order count on `customers` only.
 */
export type UserExtensionScope = 'profile' | 'customers'

export interface UserExtension {
  /** Unique id; registering the same id twice is a wiring error. */
  id: string
  /** Position of this extension's fields in the merged object (lower first). */
  order: number
  scopes: readonly UserExtensionScope[]
  /**
   * Fields to merge into each user, keyed by user id. Every id passed in
   * should get an entry so the payload shape does not depend on the data
   * (e.g. `{ loyaltyPoints: 0 }` for a user with no account).
   */
  extend(userIds: readonly string[]): Promise<Map<string, Record<string, unknown>>>
}

/**
 * User Extensions (blueprint seam 2).
 *
 * Modules contribute, Core reads: the Core `User` row carries no module data,
 * so anything a module wants shown next to a user (loyalty balance, order
 * count) is registered here from the module's onModuleInit and merged in by
 * the Core services that return users to clients (`/profile`, login/register
 * responses, `/admin/customers`). Core never names the contributing module.
 *
 * Extensions run once per call with every user id in the batch, so a list
 * endpoint costs one query per extension, not one per row.
 */
@Injectable()
export class UserExtensionsRegistry {
  private readonly extensions = new Map<string, UserExtension>()

  define(extension: UserExtension): void {
    if (this.extensions.has(extension.id))
      throw new Error(`User extension "${extension.id}" is already registered`)
    this.extensions.set(extension.id, extension)
  }

  definitions(scope: UserExtensionScope): UserExtension[] {
    return [...this.extensions.values()]
      .filter((e) => e.scopes.includes(scope))
      .sort((a, b) => a.order - b.order)
  }

  /** Returns new objects; the input rows are not mutated. */
  async apply<T extends { id: string }>(users: readonly T[], scope: UserExtensionScope): Promise<(T & Record<string, unknown>)[]> {
    if (users.length === 0) return []
    const ids = users.map((u) => u.id)
    const merged: (T & Record<string, unknown>)[] = users.map((u) => ({ ...u }))
    for (const extension of this.definitions(scope)) {
      const fields = await extension.extend(ids)
      for (const user of merged) Object.assign(user, fields.get(user.id) ?? {})
    }
    return merged
  }

  async applyOne<T extends { id: string }>(user: T, scope: UserExtensionScope): Promise<T & Record<string, unknown>>
  async applyOne<T extends { id: string }>(user: T | null, scope: UserExtensionScope): Promise<(T & Record<string, unknown>) | null>
  async applyOne<T extends { id: string }>(user: T | null, scope: UserExtensionScope) {
    if (!user) return null
    return (await this.apply([user], scope))[0]
  }
}
