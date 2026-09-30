import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../core/auth/guards/permissions.guard'
import { RequirePermissions } from '../../../core/auth/decorators/permissions.decorator'
import { AnalyticsService } from './analytics.service'

// The admin dashboard's headline numbers. Reporting over paid orders is what
// this module already owns (see AnalyticsController), under the same
// view:finance capability; the route keeps its historical /admin/stats path.
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('view:finance')
export class AnalyticsAdminController {
  constructor(private analytics: AnalyticsService) {}

  @Get()
  stats() {
    return this.analytics.dashboardStats()
  }
}
