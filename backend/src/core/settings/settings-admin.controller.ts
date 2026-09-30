import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { SettingsService } from './settings.service'

// Admin read/write of the settings table. Owned next to the resource, like
// staff, notifications, analytics and newsletter. The public read-only view
// stays in SettingsController.
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('manage:settings')
export class SettingsAdminController {
  constructor(private settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.getAdminSettings()
  }

  @Patch()
  update(@Body() body: Record<string, unknown>) {
    return this.settings.updateAdminSettings(body)
  }
}
