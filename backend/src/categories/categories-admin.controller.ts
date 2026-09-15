import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'

// Admin surface of categories, owned next to the resource like staff,
// notifications, analytics, newsletter, settings, customers and orders.
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesAdminController {
  constructor(private categories: CategoriesService) {}

  @Get()
  @RequirePermissions('view:catalog')
  list() {
    return this.categories.listForAdmin()
  }

  @Post()
  @RequirePermissions('manage:catalog')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('manage:catalog')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('manage:catalog')
  remove(@Param('id') id: string) {
    return this.categories.remove(id)
  }
}
