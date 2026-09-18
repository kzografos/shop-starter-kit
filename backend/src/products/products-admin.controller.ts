import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { ProductsService } from './products.service'
import { UpsertProductDto } from './dto/product.dto'
import { ReorderImagesDto } from './dto/product-images.dto'

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
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findByIdForAdmin(id)
  }

  @Post()
  @RequirePermissions('manage:catalog')
  create(@Body() dto: UpsertProductDto) {
    return this.products.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('manage:catalog')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto)
  }

  @Patch(':id/deactivate')
  @RequirePermissions('manage:catalog')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.deactivate(id)
  }

  // ── Images: `Product.images` in display order, index 0 = primary ──
  // Storing and deleting objects is a media operation (Core `manage:media`);
  // changing what the product shows is a catalogue write (`manage:catalog`).

  @Post(':id/images')
  @RequirePermissions('manage:catalog', 'manage:media')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  addImage(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.products.addImage(id, file)
  }

  @Patch(':id/images/order')
  @RequirePermissions('manage:catalog')
  reorderImages(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderImagesDto) {
    return this.products.reorderImages(id, dto.images)
  }

  // `:ref` is a storage key or an absolute URL, sent URL-encoded by the client
  // and decoded once by the router; keys contain no `%`, so no second decode.
  @Delete(':id/images/:ref')
  @RequirePermissions('manage:catalog', 'manage:media')
  removeImage(@Param('id', ParseUUIDPipe) id: string, @Param('ref') ref: string) {
    return this.products.removeImage(id, ref)
  }
}
