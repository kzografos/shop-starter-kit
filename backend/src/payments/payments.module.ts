import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'

@Module({
  // PricingSettingsService (loyalty earn rate) comes from the orders module.
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
