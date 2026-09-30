import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module'
import { SettingsModule } from '../../../core/settings/settings.module'
import { UsersModule } from '../../../core/users/users.module'
import { LoyaltyModule } from '../loyalty/loyalty.module'
import { AnalyticsModule } from '../analytics/analytics.module'
import { NotificationsModule } from '../../../core/notifications/notifications.module'
import { OrdersController } from './orders.controller'
import { OrdersAdminController } from './orders-admin.controller'
import { PricingSettingsService } from './pricing-settings.service'
import { OrdersPermissions } from './orders-permissions'
import { OrdersService } from './orders.service'
import { GuestOrderLinkerService } from './guest-order-linker.service'
import { OrdersUserExtension } from './orders-user.extension'
import { OrderNotificationsService } from './order-notifications.service'

@Module({
  // NotificationsModule: order status changes are announced to the customer
  // through Core's notification rows (OrderNotificationsService).
  imports: [ProductsModule, SettingsModule, UsersModule, LoyaltyModule, AnalyticsModule, NotificationsModule],
  controllers: [OrdersController, OrdersAdminController],
  // GuestOrderLinkerService subscribes to Core's user.authenticated event on init.
  // PricingSettingsService registers the pricing settings (definitions, defaults,
  // groups) with Core settings on init; Core serves the public read at GET /settings.
  // OrdersPermissions registers the order capabilities (the shop staff-role
  // presets are registered by EcommercePermissions at the shop root).
  // OrdersUserExtension registers the `_count.orders` field of /admin/customers.
  providers: [OrdersService, GuestOrderLinkerService, PricingSettingsService, OrdersPermissions, OrdersUserExtension, OrderNotificationsService],
  // OrderNotificationsService is exported for the payment webhook, which
  // confirms an order inside its own transaction.
  exports: [OrdersService, PricingSettingsService, OrderNotificationsService],
})
export class OrdersModule {}
