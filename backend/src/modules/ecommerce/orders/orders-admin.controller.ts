import { Body, Controller, Get, Param, Patch, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common'
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../core/auth/guards/permissions.guard'
import { RequirePermissions } from '../../../core/auth/decorators/permissions.decorator'
import { OrdersService } from './orders.service'

// Admin surface of orders, owned next to the resource like staff,
// notifications, analytics, newsletter, settings and customers.
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersAdminController {
  constructor(private orders: OrdersService) {}

  @Get()
  @RequirePermissions('view:orders')
  list(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('payment_status') paymentStatus?: string,
  ) {
    return this.orders.listForAdmin({
      page: page ? parseInt(page, 10) : 1,
      search,
      paymentStatus,
    })
  }

  @Patch(':id/status')
  @RequirePermissions('manage:orders')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    return this.orders.updateStatus(id, status)
  }
}
