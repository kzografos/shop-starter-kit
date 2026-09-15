import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { envValidationSchema } from './core/config/env.validation'
import { PrismaModule } from './prisma/prisma.module'
import { CoreEventModule } from './core/events/core-event.module'
import { PermissionsModule } from './auth/permissions.module'
import { RedisModule } from './redis/redis.module'
import { MailModule } from './mail/mail.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ProductsModule } from './products/products.module'
import { CategoriesModule } from './categories/categories.module'
import { OrdersModule } from './orders/orders.module'
import { PaymentsModule } from './payments/payments.module'
import { FavouritesModule } from './favourites/favourites.module'
import { NewsletterModule } from './newsletter/newsletter.module'
import { ProfileModule } from './profile/profile.module'
import { MinioModule } from './minio/minio.module'
import { UploadsModule } from './uploads/uploads.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { StaffModule } from './staff/staff.module'
import { SettingsModule } from './settings/settings.module'

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
    FavouritesModule,
    NewsletterModule,
    ProfileModule,
    MinioModule,
    UploadsModule,
    NotificationsModule,
    AnalyticsModule,
    StaffModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
