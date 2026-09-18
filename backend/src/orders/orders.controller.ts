import { BadRequestException, Controller, Get, Post, Body, Headers, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  // Guests and logged-in users can both place orders.
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string; email: string } | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Optional. A client that sends one gets exactly one order per key (see
    // OrdersService.create); a client that does not behaves as before.
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be 8–128 characters of A-Z, a-z, 0-9, "-" or "_"')
    }
    return this.orders.create(user?.id ?? null, user?.email ?? null, dto, idempotencyKey)
  }

  // Order history requires login.
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: { id: string }) {
    return this.orders.findByUser(user.id)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.orders.findOneForUser(id, user.id)
  }

  // A customer may cancel their own order while it is still pending and
  // unpaid; the response is the updated order, as GET /orders/:id returns it.
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.orders.cancelForCustomer(id, user.id)
  }
}
