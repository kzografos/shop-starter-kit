/**
 * Core event contract.
 *
 * Core emits generic identity/session events. Optional modules subscribe to
 * them to run their own side effects. Payloads carry only generic data that
 * Core already owns — never domain data from a module.
 *
 * Adding an event: add a key to CoreEventMap with its payload type. Modules
 * that emit their own events declare their own map in their own folder.
 */

/** Fired after a user has successfully authenticated (register, login, OAuth). */
export interface UserAuthenticatedEvent {
  userId: string
  email: string
  /** True when the account was created by this same request. */
  isNewUser: boolean
}

export interface CoreEventMap {
  'user.authenticated': UserAuthenticatedEvent
}

export type CoreEventName = keyof CoreEventMap

export type CoreEventHandler<N extends CoreEventName> = (
  payload: CoreEventMap[N],
) => void | Promise<void>
