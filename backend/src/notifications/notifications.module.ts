import { Module } from '@nestjs/common'
import { PrismaModule } from '../infrastructure/prisma/prisma.module'
import { NotificationsController } from './notifications.controller'
import { CustomerNotificationsController } from './customer-notifications.controller'
import { NotificationsService } from './notifications.service'

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, CustomerNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
