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
import { UpsertProductDto } from './dto/product.dto'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  @RequirePermissions('view:finance')
  stats() {
    return this.admin.getStats()
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
  createProduct(@Body() dto: UpsertProductDto) {
    return this.admin.createProduct(dto)
  }

  @Patch('products/:id')
  @RequirePermissions('manage:catalog')
  updateProduct(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.admin.updateProduct(id, dto)
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
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto)
  }

  @Patch('categories/:id')
  @RequirePermissions('manage:catalog')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto)
  }

  @Delete('categories/:id')
  @RequirePermissions('manage:catalog')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id)
  }

}
