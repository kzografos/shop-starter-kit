import { Module } from '@nestjs/common'
import { MinioModule } from '../minio/minio.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProductsController } from './products.controller'
import { ProductsAdminController } from './products-admin.controller'
import { ProductsService } from './products.service'

@Module({
  imports: [MinioModule, NotificationsModule],
  controllers: [ProductsController, ProductsAdminController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
