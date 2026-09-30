import { Injectable, Logger } from '@nestjs/common'
import type { CoreEventHandler, CoreEventMap, CoreEventName } from './core-event.types'

interface Subscription<N extends CoreEventName> {
  subscriber: string
  handler: CoreEventHandler<N>
}

/**
 * Minimal in-process event bus (ARCHITECTURE-DECISIONS D8).
 *
 * Handlers run sequentially and are awaited, so an emitter that needs the side
 * effects to be visible in its own response (e.g. the user object returned by
 * login) gets that by awaiting emit(). A handler that throws is logged and
 * skipped — it never fails the emitter (failure policy E14). Anything that must
 * be durable belongs in the handler's own transaction, not in the bus.
 *
 * No persistence, no retries, no ordering guarantees across subscribers beyond
 * registration order. Deliberately not a queue.
 */
@Injectable()
export class CoreEventBus {
  private readonly logger = new Logger(CoreEventBus.name)
  private readonly subscriptions = new Map<CoreEventName, Subscription<CoreEventName>[]>()

  /**
   * Registers a handler. `subscriber` names the owner for log lines; use the
   * class name of the subscribing provider.
   */
  on<N extends CoreEventName>(event: N, subscriber: string, handler: CoreEventHandler<N>): void {
    const list = this.subscriptions.get(event) ?? []
    list.push({ subscriber, handler: handler as CoreEventHandler<CoreEventName> })
    this.subscriptions.set(event, list)
  }

  async emit<N extends CoreEventName>(event: N, payload: CoreEventMap[N]): Promise<void> {
    const list = this.subscriptions.get(event) ?? []
    for (const { subscriber, handler } of list) {
      try {
        await handler(payload)
      } catch (err) {
        this.logger.error(
          `Subscriber ${subscriber} failed on ${event}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        )
      }
    }
  }
}
