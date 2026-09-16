import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module'
import { CategoriesController } from './categories.controller'
import { CategoriesAdminController } from './categories-admin.controller'
import { CategoriesService } from './categories.service'

@Module({
  // ProductsService.invalidate(): category writes drop the product caches.
  imports: [ProductsModule],
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
