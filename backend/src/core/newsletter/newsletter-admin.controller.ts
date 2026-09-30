import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { NewsletterService } from './newsletter.service'

// Owned here rather than in the admin module: the admin surface of a resource
// lives next to the resource (same pattern as staff, notifications, analytics).
@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('manage:marketing')
export class NewsletterAdminController {
  constructor(private newsletter: NewsletterService) {}

  @Get()
  list() {
    return this.newsletter.listSubscribers()
  }
}
