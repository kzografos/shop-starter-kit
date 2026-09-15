import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { ProductsService } from './products.service'
import { UpsertProductDto } from './dto/product.dto'

// Admin surface of products, owned next to the resource like the other
// admin/* controllers. The public catalogue stays in ProductsController.
@Controller('admin/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsAdminController {
  constructor(private products: ProductsService) {}

  @Get()
  @RequirePermissions('view:catalog')
  list(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.products.listForAdmin({
      page: page ? parseInt(page, 10) : 1,
      search,
      sort,
      order: order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('view:catalog')
  byId(@Param('id') id: string) {
    return this.products.findByIdForAdmin(id)
  }

  @Post()
  @RequirePermissions('manage:catalog')
  create(@Body() dto: UpsertProductDto) {
    return this.products.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('manage:catalog')
  update(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto)
  }

  @Patch(':id/deactivate')
  @RequirePermissions('manage:catalog')
  deactivate(@Param('id') id: string) {
    return this.products.deactivate(id)
  }
}
