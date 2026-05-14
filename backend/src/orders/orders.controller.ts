import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.orders.create(user.id, user.email, dto)
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.orders.findByUser(user.id)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.orders.findOneForUser(id, user.id)
  }
}
