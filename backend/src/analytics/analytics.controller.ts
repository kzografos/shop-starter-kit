import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { AnalyticsService } from './analytics.service'

const GRANULARITIES = ['day', 'week', 'month'] as const
type Granularity = (typeof GRANULARITIES)[number]

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('view:finance')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get()
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
    @Query('compare') compare?: string,
  ) {
    if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to)))
      throw new BadRequestException('from and to must be valid ISO dates')
    const gran: Granularity = GRANULARITIES.includes(granularity as Granularity)
      ? (granularity as Granularity)
      : 'day'
    return this.analytics.overview(from, to, gran, compare === 'true')
  }
}
