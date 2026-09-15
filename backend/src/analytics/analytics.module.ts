import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsAdminController } from './analytics-admin.controller'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
