import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { AdminService } from './admin.service'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  @RequirePermissions('view:finance')
  stats() {
    return this.admin.getStats()
  }

  @Get('orders')
  @RequirePermissions('view:orders')
  orders() {
    return this.admin.getOrders()
  }

  @Patch('orders/:id/status')
  @RequirePermissions('manage:orders')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.admin.updateOrderStatus(id, status)
  }

  @Get('products')
  @RequirePermissions('view:catalog')
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
  @RequirePermissions('view:catalog')
  productById(@Param('id') id: string) {
    return this.admin.getProductById(id)
  }

  @Post('products')
  @RequirePermissions('manage:catalog')
  createProduct(@Body() body: Record<string, unknown>) {
    return this.admin.createProduct(body)
  }

  @Patch('products/:id')
  @RequirePermissions('manage:catalog')
  updateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateProduct(id, body)
  }

  @Patch('products/:id/deactivate')
  @RequirePermissions('manage:catalog')
  deactivateProduct(@Param('id') id: string) {
    return this.admin.deactivateProduct(id)
  }

  // ── Categories ─────────────────────────────────────────────

  @Get('categories')
  @RequirePermissions('view:catalog')
  categories() {
    return this.admin.getCategories()
  }

  @Post('categories')
  @RequirePermissions('manage:catalog')
  createCategory(@Body() body: Record<string, unknown>) {
    return this.admin.createCategory(body)
  }

  @Patch('categories/:id')
  @RequirePermissions('manage:catalog')
  updateCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateCategory(id, body)
  }

  @Delete('categories/:id')
  @RequirePermissions('manage:catalog')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id)
  }

  // ── Customers + Newsletter ─────────────────────────────────

  @Get('customers')
  @RequirePermissions('view:customers')
  customers(@Query('page') page?: string, @Query('search') search?: string) {
    return this.admin.getCustomers({ page: page ? parseInt(page, 10) : 1, search })
  }

  @Get('newsletter')
  @RequirePermissions('manage:marketing')
  newsletter() {
    return this.admin.getNewsletter()
  }

  // ── Settings ───────────────────────────────────────────────

  @Get('settings')
  @RequirePermissions('manage:settings')
  settings() {
    return this.admin.getSettings()
  }

  @Patch('settings')
  @RequirePermissions('manage:settings')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.admin.updateSettings(body)
  }
}
