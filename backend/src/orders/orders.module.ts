import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { SettingsModule } from '../settings/settings.module'
import { OrdersController } from './orders.controller'
import { OrdersAdminController } from './orders-admin.controller'
import { OrdersService } from './orders.service'
import { LoyaltyService } from './loyalty.service'
import { GuestOrderLinkerService } from './guest-order-linker.service'

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [OrdersController, OrdersAdminController],
  // GuestOrderLinkerService subscribes to Core's user.authenticated event on init.
  providers: [OrdersService, LoyaltyService, GuestOrderLinkerService],
  exports: [OrdersService],
})
export class OrdersModule {}
