import { Module } from '@nestjs/common'
import { ProductsModule } from './products/products.module'
import { CategoriesModule } from './categories/categories.module'
import { FavouritesModule } from './favourites/favourites.module'
import { OrdersModule } from './orders/orders.module'
import { PaymentsModule } from './payments/payments.module'
import { LoyaltyModule } from './loyalty/loyalty.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { EcommercePermissions } from './ecommerce-permissions'

/**
 * Root of the e-commerce module (blueprint §13 Phase 1): the one Nest module
 * the composition root imports for the shop. The seven sub-domains keep their
 * own modules and their explicit imports of each other and of Core; this
 * module only groups them and owns what belongs to the shop as a whole —
 * today the staff-role presets (EcommercePermissions).
 *
 * Exports nothing on purpose: no module outside the shop consumes a shop
 * provider, and Core must never import from here (DEPENDENCY-RULES §3).
 */
@Module({
  imports: [ProductsModule, CategoriesModule, FavouritesModule, OrdersModule, PaymentsModule, LoyaltyModule, AnalyticsModule],
  providers: [EcommercePermissions],
})
export class EcommerceModule {}
