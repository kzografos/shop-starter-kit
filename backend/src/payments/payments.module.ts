import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'
import { LoyaltyModule } from '../loyalty/loyalty.module'

@Module({
  // PricingSettingsService (loyalty earn rate) comes from the orders module;
  // LoyaltyService (where the points are stored) from the loyalty module.
  imports: [OrdersModule, LoyaltyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
