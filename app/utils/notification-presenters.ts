import type { Notification } from '~~/types'

/** What the feed renders for one row: text plus, when it exists, where it leads. */
export interface NotificationView {
  title: string
  body: string
  to: string | null
}

/** What a presenter may use: translation and locale-aware paths, nothing else. */
export interface NotificationPresenterContext {
  t: (key: string, values?: Record<string, unknown>) => string
  localePath: (path: string) => string
}

export type NotificationPresenter = (n: Notification, ctx: NotificationPresenterContext) => NotificationView

// Registration is static (a module's plugin registers at boot), so a
// module-level map is safe to share across requests: no per-user state lives here.
const presenters = new Map<string, NotificationPresenter>()

/**
 * Registers how rows of one `type` are phrased. The module that produces the
 * rows owns the presenter (its `meta` shape, its wording keys, its route);
 * Core's bell, panel and history page only call `describeNotification()`.
 * Registering a type twice keeps the last presenter — a project layer may
 * override a module's wording.
 */
export function registerNotificationPresenter(type: string, presenter: NotificationPresenter): void {
  presenters.set(type, presenter)
}

/** Registered presenter types, for tests and diagnostics. */
export function registeredNotificationTypes(): string[] {
  return [...presenters.keys()]
}

/**
 * Title, body and destination for one row. A type nobody registered falls
 * back to the generic line, so a new row type never renders blank — the same
 * fallback the feed always had. A presenter that throws falls back the same
 * way: wording is never allowed to break the header.
 */
export function describeNotification(n: Notification, ctx: NotificationPresenterContext): NotificationView {
  const presenter = presenters.get(n.type)
  if (presenter) {
    try {
      return presenter(n, ctx)
    } catch {
      // fall through to the generic line
    }
  }
  return { title: ctx.t('notifications.generic_title'), body: '', to: null }
}
