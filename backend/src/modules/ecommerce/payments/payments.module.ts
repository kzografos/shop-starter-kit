import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'
import { LoyaltyModule } from '../loyalty/loyalty.module'
import { AnalyticsModule } from '../analytics/analytics.module'

@Module({
  // PricingSettingsService (loyalty earn rate) comes from the orders module;
  // LoyaltyService (where the points are stored) from the loyalty module;
  // AnalyticsService owns the report cache a settled payment invalidates.
  imports: [OrdersModule, LoyaltyModule, AnalyticsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
