import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { UsersModule } from '../users/users.module'
import { LoyaltyService } from './loyalty.service'
import { LoyaltyController } from './loyalty.controller'
import { LoyaltyUserExtension } from './loyalty-user.extension'

// E-commerce `loyalty` sub-domain: balance, ledger, the customer's history
// endpoint, and the `loyaltyPoints` user extension. Orders and payments call
// LoyaltyService instead of touching the loyalty tables themselves.
@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [LoyaltyController],
  // LoyaltyUserExtension registers with Core's UserExtensionsRegistry on init.
  providers: [LoyaltyService, LoyaltyUserExtension],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
