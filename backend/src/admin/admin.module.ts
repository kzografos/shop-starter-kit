import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { SettingsModule } from '../settings/settings.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [PrismaModule, NotificationsModule, SettingsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
