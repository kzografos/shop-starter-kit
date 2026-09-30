import { Injectable, OnModuleInit } from '@nestjs/common'
import { PermissionsRegistryService } from '../../core/auth/permissions.registry.service'

/**
 * Shop staff-role presets. Role names are the lowercase values stored in
 * `users.role`. Owned by the e-commerce module as a whole (not by one
 * sub-domain): a preset spans capabilities that analytics, orders, the
 * catalogue and Core register separately, so it is defined once at the shop
 * root and registered by EcommerceModule.
 *
 * The capability ids are registered by their owners (AnalyticsPermissions,
 * OrdersPermissions, CatalogPermissions, Core); the registry checks every
 * reference at bootstrap and fails boot if one is missing.
 */
export const SHOP_ROLE_PRESETS: Record<string, readonly string[]> = {
  accountant: ['view:finance', 'view:orders'],
  // Stock managers also read the admin inbox, where the low-stock alerts land,
  // and upload product images.
  stock_manager: ['view:catalog', 'manage:catalog', 'manage:inventory', 'view:notifications', 'manage:media'],
}

@Injectable()
export class EcommercePermissions implements OnModuleInit {
  constructor(private permissions: PermissionsRegistryService) {}

  onModuleInit() {
    for (const [role, caps] of Object.entries(SHOP_ROLE_PRESETS)) {
      this.permissions.defineRolePreset(role, caps)
    }
  }
}
