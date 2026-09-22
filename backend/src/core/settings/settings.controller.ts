import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { SettingsService } from './settings.service'

/**
 * Public, read-only view of the settings a module marked `public` — the
 * values the storefront needs to show what the server will compute (shipping
 * cost, loyalty rates). Nothing else in the store is reachable here, whatever
 * is stored: the filter is the registry, not the caller. Writing stays behind
 * the admin guard (SettingsAdminController).
 */
@SkipThrottle()
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.getPublic()
  }
}
