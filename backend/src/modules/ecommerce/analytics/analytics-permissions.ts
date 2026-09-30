import { Injectable, OnModuleInit } from '@nestjs/common'
import { PermissionsRegistryService } from '../../../core/auth/permissions.registry.service'

/** Capabilities owned by analytics (dashboard revenue + reports). */
export const ANALYTICS_CAPABILITIES = ['view:finance'] as const

@Injectable()
export class AnalyticsPermissions implements OnModuleInit {
  constructor(private permissions: PermissionsRegistryService) {}

  onModuleInit() {
    this.permissions.defineCapabilities(ANALYTICS_CAPABILITIES, { order: 10 })
  }
}
