import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  // Guests and logged-in users can both place orders.
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string; email: string } | undefined,
  ) {
    return this.orders.create(user?.id ?? null, user?.email ?? null, dto)
  }

  // Order history requires login.
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: { id: string }) {
    return this.orders.findByUser(user.id)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.orders.findOneForUser(id, user.id)
  }

  // A customer may cancel their own order while it is still pending and
  // unpaid; the response is the updated order, as GET /orders/:id returns it.
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.orders.cancelForCustomer(id, user.id)
  }
}
