import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module'
import { SettingsModule } from '../settings/settings.module'
import { OrdersController } from './orders.controller'
import { OrdersAdminController } from './orders-admin.controller'
import { PricingSettingsController } from './pricing-settings.controller'
import { PricingSettingsService } from './pricing-settings.service'
import { OrdersService } from './orders.service'
import { LoyaltyService } from './loyalty.service'
import { GuestOrderLinkerService } from './guest-order-linker.service'

@Module({
  imports: [ProductsModule, SettingsModule],
  controllers: [OrdersController, OrdersAdminController, PricingSettingsController],
  // GuestOrderLinkerService subscribes to Core's user.authenticated event on init.
  // PricingSettingsService registers the pricing keys with Core settings on init.
  providers: [OrdersService, LoyaltyService, GuestOrderLinkerService, PricingSettingsService],
  exports: [OrdersService, PricingSettingsService],
})
export class OrdersModule {}
