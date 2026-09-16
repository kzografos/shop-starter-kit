/**
 * Online payments behind one provider-neutral surface (blueprint D7).
 *
 * The e-commerce `payments` sub-domain shapes an order into checkout lines
 * and reacts to the provider's events; how a checkout session, a discount or
 * a signed webhook is expressed in a given PSP's API is the provider's
 * business. Amounts are integers in the currency's minor unit (cents).
 *
 * Declared as an abstract class so it doubles as the Nest injection token.
 */
export interface CheckoutLine {
  name: string
  unitAmountMinor: number
  quantity: number
}

export interface CreateCheckoutInput {
  orderId: string
  /** `null` for a guest order. */
  userId: string | null
  /** Product lines plus any shipping line, already shaped by the caller. */
  lines: CheckoutLine[]
  /** 0 = no discount. */
  discountMinor: number
  discountLabel: string
  /** ISO 4217, lowercase (`'eur'`). */
  currency: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  id: string
  url: string | null
}

export interface CheckoutStatus {
  /** Owner recorded on the session; `null` for a guest checkout. */
  userId: string | null
  /** The provider's payment status string, passed through verbatim (`'paid'`, `'unpaid'`, …). */
  status: string
}

/** A checkout that the provider reports as completed. */
export interface CheckoutCompleted {
  orderId: string | null
  /** `null` for a guest order. */
  userId: string | null
  amountTotalMinor: number | null
  paymentIntentId: string | null
}

/**
 * A verified webhook event. `id`/`type` are the provider's own values and are
 * stored verbatim in the ProcessedEvent ledger; `checkoutCompleted` is set
 * only for the event type that settles an order.
 */
export type WebhookEvent =
  | { id: string; type: string; checkoutCompleted: null }
  | { id: string; type: 'checkout.session.completed'; checkoutCompleted: CheckoutCompleted }

export abstract class PaymentProvider {
  /** True when a provider is configured; every operation below throws 503 otherwise. */
  abstract readonly isEnabled: boolean

  /** Throws the provider's 503 when not configured; callers use it to fail before any DB work. */
  abstract assertEnabled(): void

  abstract createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>

  abstract getCheckoutStatus(sessionId: string): Promise<CheckoutStatus>

  /** Verifies the signature and parses the payload; throws `BadRequestException('Invalid webhook signature')`. */
  abstract parseWebhook(rawBody: Buffer, signature: string): WebhookEvent
}
