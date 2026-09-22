import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsAdminController } from './analytics-admin.controller'
import { AnalyticsService } from './analytics.service'
import { AnalyticsPermissions } from './analytics-permissions'

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [AnalyticsService, AnalyticsPermissions],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
