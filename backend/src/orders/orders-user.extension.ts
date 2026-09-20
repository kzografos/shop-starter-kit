import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../infrastructure/prisma/prisma.service'
import { UserExtensionsRegistry } from '../users/user-extensions.registry'

/**
 * Puts the order count on each row of `/admin/customers`, in the `_count.orders`
 * shape the admin page has always read. Registered by the orders module so the
 * Core customer list no longer counts a shop relation itself.
 */
@Injectable()
export class OrdersUserExtension implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private registry: UserExtensionsRegistry,
  ) {}

  onModuleInit() {
    this.registry.define({
      id: 'orders',
      order: 20,
      scopes: ['customers'],
      extend: async (userIds) => {
        const counts = await this.prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: [...userIds] } },
          _count: { _all: true },
        })
        const result = new Map(userIds.map((id) => [id, { _count: { orders: 0 } }]))
        for (const c of counts) if (c.userId) result.set(c.userId, { _count: { orders: c._count._all } })
        return result
      },
    })
  }
}
