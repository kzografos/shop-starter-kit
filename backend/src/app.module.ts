import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import * as Joi from 'joi'
import { PrismaModule } from './prisma/prisma.module'
import { CoreEventModule } from './core/events/core-event.module'
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
import { AdminModule } from './admin/admin.module'
import { MinioModule } from './minio/minio.module'
import { UploadsModule } from './uploads/uploads.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { StaffModule } from './staff/staff.module'
import { SettingsModule } from './settings/settings.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_PORT: Joi.number().default(9000),
        MINIO_ROOT_USER: Joi.string().required(),
        MINIO_ROOT_PASSWORD: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        MINIO_PUBLIC_URL: Joi.string().required(),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
      }),
    }),
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
    AdminModule,
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
