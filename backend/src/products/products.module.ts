import { Module } from '@nestjs/common'
import { MinioModule } from '../minio/minio.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProductsController } from './products.controller'
import { ProductsAdminController } from './products-admin.controller'
import { ProductsService } from './products.service'
import { StockAlertsService } from './stock-alerts.service'

@Module({
  imports: [MinioModule, NotificationsModule],
  controllers: [ProductsController, ProductsAdminController],
  providers: [ProductsService, StockAlertsService],
  exports: [ProductsService, StockAlertsService],
})
export class ProductsModule {}
