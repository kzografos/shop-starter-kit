import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { PricingSettingsService } from './pricing-settings.service'

/**
 * Public, read-only view of the pricing rules the storefront needs to display a
 * total that matches what the server will charge.
 *
 * These values are not secret: shipping cost and the free-shipping threshold are
 * already shown on the shipping banner, and the loyalty conversion rate is shown
 * on the account page. Writing them stays behind the admin guard
 * (settings/settings-admin.controller.ts).
 */
@SkipThrottle()
@Controller('settings')
export class PricingSettingsController {
  constructor(private pricing: PricingSettingsService) {}

  @Get()
  get() {
    return this.pricing.loadPricing()
  }
}
