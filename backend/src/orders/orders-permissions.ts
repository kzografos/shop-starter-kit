import { Injectable, OnModuleInit } from '@nestjs/common'
import { PermissionsRegistryService } from '../auth/permissions.registry.service'

/** Capabilities owned by orders. */
export const ORDERS_CAPABILITIES = [
  'view:orders',
  'manage:orders', // status changes, refunds
] as const

/**
 * Shop staff-role presets. Role names are the lowercase values stored in `users.role`.
 * Registered here because the e-commerce module has no single root yet;
 * they move to ecommerce.module.ts with the folder layers.
 */
export const SHOP_ROLE_PRESETS: Record<string, readonly string[]> = {
  accountant: ['view:finance', 'view:orders'],
  // Stock managers also read the admin inbox, where the low-stock alerts land,
  // and upload product images.
  stock_manager: ['view:catalog', 'manage:catalog', 'manage:inventory', 'view:notifications', 'manage:media'],
}

@Injectable()
export class OrdersPermissions implements OnModuleInit {
  constructor(private permissions: PermissionsRegistryService) {}

  onModuleInit() {
    this.permissions.defineCapabilities(ORDERS_CAPABILITIES, { order: 20 })
    for (const [role, caps] of Object.entries(SHOP_ROLE_PRESETS)) {
      this.permissions.defineRolePreset(role, caps)
    }
  }
}
