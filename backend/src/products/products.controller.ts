import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('category') category?: string,
    @Query('categories') categories?: string,
    @Query('brand') brand?: string,
    @Query('animalAge') animalAge?: string,
    @Query('search') search?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
  ) {
    return this.products.findAll({
      page: page ? parseInt(page, 10) : 1,
      category,
      categories: categories ? categories.split(',').filter(Boolean) : undefined,
      brand,
      animalAge,
      search,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
    })
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
