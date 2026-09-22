import { Injectable, OnModuleInit } from '@nestjs/common'
import { PermissionsRegistryService } from '../../../core/auth/permissions.registry.service'

/** Capabilities owned by the catalogue (products, categories, uploads, stock alerts). */
export const CATALOG_CAPABILITIES = [
  'view:catalog', // products + categories (read)
  'manage:catalog', // products + categories (write)
  'manage:inventory', // stock, low-stock notifications, suppliers (future)
] as const

@Injectable()
export class CatalogPermissions implements OnModuleInit {
  constructor(private permissions: PermissionsRegistryService) {}

  onModuleInit() {
    this.permissions.defineCapabilities(CATALOG_CAPABILITIES, { order: 30 })
  }
}
