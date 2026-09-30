import { Module } from '@nestjs/common'
import { NotificationsModule } from '../../../core/notifications/notifications.module'
import { UploadsModule } from '../../../core/uploads/uploads.module'
import { ProductsController } from './products.controller'
import { ProductsAdminController } from './products-admin.controller'
import { ProductsService } from './products.service'
import { StockAlertsService } from './stock-alerts.service'
import { CatalogPermissions } from './catalog-permissions'

@Module({
  // UploadsService: the product image sub-resource stores files through the
  // same Core validation as POST /uploads/image.
  imports: [NotificationsModule, UploadsModule],
  controllers: [ProductsController, ProductsAdminController],
  // CatalogPermissions registers the catalogue capabilities on init.
  providers: [ProductsService, StockAlertsService, CatalogPermissions],
  exports: [ProductsService, StockAlertsService],
})
export class ProductsModule {}
