import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { AdminService } from './admin.service'

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.getStats()
  }

  @Get('orders')
  orders() {
    return this.admin.getOrders()
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.admin.updateOrderStatus(id, status)
  }

  @Get('products')
  products(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.admin.getProducts({
      page: page ? parseInt(page, 10) : 1,
      search,
      sort,
      order: order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined,
    })
  }

  @Get('products/:id')
  productById(@Param('id') id: string) {
    return this.admin.getProductById(id)
  }

  @Post('products')
  createProduct(@Body() body: Record<string, unknown>) {
    return this.admin.createProduct(body)
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateProduct(id, body)
  }

  @Patch('products/:id/deactivate')
  deactivateProduct(@Param('id') id: string) {
    return this.admin.deactivateProduct(id)
  }
}
