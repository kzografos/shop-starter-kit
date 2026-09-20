import { Global, Module } from '@nestjs/common'
import { PaymentProvider } from './payment-provider'
import { StripePaymentProvider } from './stripe.provider'

// Infrastructure: online payments. Global so the payments sub-domain can inject
// PaymentProvider; the only implementation today is Stripe.
@Global()
@Module({
  providers: [StripePaymentProvider, { provide: PaymentProvider, useExisting: StripePaymentProvider }],
  exports: [PaymentProvider],
})
export class PaymentsProviderModule {}
