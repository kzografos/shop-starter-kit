import { Injectable, OnModuleInit } from '@nestjs/common'
import { UserExtensionsRegistry } from '../users/user-extensions.registry'
import { LoyaltyService } from './loyalty.service'

/**
 * Puts `loyaltyPoints` on every user object Core returns to a client
 * (`/profile`, login/register responses, `/admin/customers`) — the field the
 * frontend read from the former `User.loyaltyPoints` column.
 */
@Injectable()
export class LoyaltyUserExtension implements OnModuleInit {
  constructor(
    private registry: UserExtensionsRegistry,
    private loyalty: LoyaltyService,
  ) {}

  onModuleInit() {
    this.registry.define({
      id: 'loyalty',
      order: 10,
      scopes: ['profile', 'customers'],
      extend: async (userIds) => {
        const balances = await this.loyalty.balances(userIds)
        return new Map([...balances].map(([id, points]) => [id, { loyaltyPoints: points }]))
      },
    })
  }
}
