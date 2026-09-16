import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module'
import { SettingsModule } from '../settings/settings.module'
import { UsersModule } from '../users/users.module'
import { LoyaltyModule } from '../loyalty/loyalty.module'
import { OrdersController } from './orders.controller'
import { OrdersAdminController } from './orders-admin.controller'
import { PricingSettingsController } from './pricing-settings.controller'
import { PricingSettingsService } from './pricing-settings.service'
import { OrdersPermissions } from './orders-permissions'
import { OrdersService } from './orders.service'
import { GuestOrderLinkerService } from './guest-order-linker.service'
import { OrdersUserExtension } from './orders-user.extension'

@Module({
  imports: [ProductsModule, SettingsModule, UsersModule, LoyaltyModule],
  controllers: [OrdersController, OrdersAdminController, PricingSettingsController],
  // GuestOrderLinkerService subscribes to Core's user.authenticated event on init.
  // PricingSettingsService registers the pricing keys with Core settings on init.
  // OrdersPermissions registers the order capabilities and the shop staff-role presets.
  // OrdersUserExtension registers the `_count.orders` field of /admin/customers.
  providers: [OrdersService, GuestOrderLinkerService, PricingSettingsService, OrdersPermissions, OrdersUserExtension],
  exports: [OrdersService, PricingSettingsService],
})
export class OrdersModule {}
