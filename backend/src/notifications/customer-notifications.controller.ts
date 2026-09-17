import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NotificationsService } from './notifications.service'

// A signed-in user's own notification feed. No capability: ownership is the
// rule, enforced by the service scoping every query to the caller.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class CustomerNotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Query('page') page?: string, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.id, { page: Number(page) || 1, unreadOnly: unread === 'true' })
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: string }) {
    return this.notifications.unreadCountForUser(user.id)
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notifications.markAllReadForUser(user.id)
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.notifications.markReadForUser(id, user.id)
  }
}
