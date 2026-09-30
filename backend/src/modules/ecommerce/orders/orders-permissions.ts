import { Injectable, OnModuleInit } from '@nestjs/common'
import { PermissionsRegistryService } from '../../../core/auth/permissions.registry.service'

/** Capabilities owned by orders. */
export const ORDERS_CAPABILITIES = [
  'view:orders',
  'manage:orders', // status changes, refunds
] as const

@Injectable()
export class OrdersPermissions implements OnModuleInit {
  constructor(private permissions: PermissionsRegistryService) {}

  onModuleInit() {
    this.permissions.defineCapabilities(ORDERS_CAPABILITIES, { order: 20 })
  }
}
