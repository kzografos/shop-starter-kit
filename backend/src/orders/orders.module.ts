import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { SettingsModule } from '../settings/settings.module'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
