import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { UsersService } from './users.service'

// Admin list of customer accounts. Owned next to the resource, like staff,
// notifications, analytics, newsletter and settings.
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersAdminController {
  constructor(private users: UsersService) {}

  @Get()
  @RequirePermissions('view:customers')
  list(@Query('page') page?: string, @Query('search') search?: string) {
    return this.users.listCustomers({ page: page ? parseInt(page, 10) : 1, search })
  }
}
