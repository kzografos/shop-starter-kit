import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { NotificationsService } from './notifications.service'

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('manage:inventory')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('unread') unread?: string) {
    return this.notifications.list({ page: Number(page) || 1, unreadOnly: unread === 'true' })
  }

  @Get('unread-count')
  unreadCount() {
    return this.notifications.unreadCount()
  }

  @Patch('read-all')
  markAllRead() {
    return this.notifications.markAllRead()
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id)
  }
}
