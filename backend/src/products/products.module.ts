import { Module } from '@nestjs/common'
import { MinioModule } from '../minio/minio.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProductsController } from './products.controller'
import { ProductsAdminController } from './products-admin.controller'
import { ProductsService } from './products.service'
import { StockAlertsService } from './stock-alerts.service'
import { CatalogPermissions } from './catalog-permissions'

@Module({
  imports: [MinioModule, NotificationsModule],
  controllers: [ProductsController, ProductsAdminController],
  // CatalogPermissions registers the catalogue capabilities on init.
  providers: [ProductsService, StockAlertsService, CatalogPermissions],
  exports: [ProductsService, StockAlertsService],
})
export class ProductsModule {}
