import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ProductsService } from './products.service'
import { QueryProductsDto } from './dto/query-products.dto'

@SkipThrottle()
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.products.findAll(query)
  }

  @Get('brands')
  findBrands() {
    return this.products.findBrands()
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findBySlug(slug)
  }

  @Get(':slug/related')
  async findRelated(@Param('slug') slug: string) {
    const product = await this.products.findBySlug(slug).catch(() => null)
    if (!product) throw new NotFoundException('Product not found')
    return this.products.findRelated(product.brand, product.categoryId, product.id)
  }
}
