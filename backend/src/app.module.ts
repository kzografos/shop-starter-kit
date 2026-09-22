import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { envValidationSchema } from './core/config/env.validation'
import { PrismaModule } from './infrastructure/prisma/prisma.module'
import { CoreEventModule } from './core/events/core-event.module'
import { PermissionsModule } from './core/auth/permissions.module'
import { RedisModule } from './infrastructure/redis/redis.module'
import { MailModule } from './infrastructure/mail/mail.module'
import { HealthModule } from './infrastructure/health/health.module'
import { AuthModule } from './core/auth/auth.module'
import { UsersModule } from './core/users/users.module'
import { ProductsModule } from './modules/ecommerce/products/products.module'
import { CategoriesModule } from './modules/ecommerce/categories/categories.module'
import { OrdersModule } from './modules/ecommerce/orders/orders.module'
import { PaymentsModule } from './modules/ecommerce/payments/payments.module'
import { LoyaltyModule } from './modules/ecommerce/loyalty/loyalty.module'
import { FavouritesModule } from './modules/ecommerce/favourites/favourites.module'
import { NewsletterModule } from './core/newsletter/newsletter.module'
import { ProfileModule } from './core/profile/profile.module'
import { StorageModule } from './infrastructure/storage/storage.module'
import { PaymentsProviderModule } from './infrastructure/payments-provider/payments-provider.module'
import { UploadsModule } from './core/uploads/uploads.module'
import { NotificationsModule } from './core/notifications/notifications.module'
import { AnalyticsModule } from './modules/ecommerce/analytics/analytics.module'
import { StaffModule } from './core/staff/staff.module'
import { SettingsModule } from './core/settings/settings.module'

@Module({
  imports: [
    // Core keys are required; provider keys are validated only when their
    // provider is present. See core/config/env.validation.ts.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: ['req.headers.cookie', 'req.headers.authorization'],
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    PrismaModule,
    CoreEventModule,
    PermissionsModule,
    RedisModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    PaymentsModule,
    LoyaltyModule,
    FavouritesModule,
    NewsletterModule,
    ProfileModule,
    StorageModule,
    PaymentsProviderModule,
    UploadsModule,
    NotificationsModule,
    AnalyticsModule,
    StaffModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
