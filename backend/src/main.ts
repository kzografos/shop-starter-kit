import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import * as cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { SnakeCaseInterceptor } from './infrastructure/common/interceptors/snake-case.interceptor'
import { GlobalExceptionFilter } from './infrastructure/common/filters/http-exception.filter'

async function bootstrap() {
  // rawBody: required by the payments module (Stripe webhook signature check).
  // Harmless for everything else; kept unconditional so the option is not
  // silently missing the day payments are enabled.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true })

  app.useLogger(app.get(Logger))

  app.use(helmet())
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(new SnakeCaseInterceptor())

  const isDev = process.env.NODE_ENV !== 'production'
  // Dev: allow any localhost port. Prod: explicit allow-list from NUXT_URL (comma-separated).
  const allowedOrigins = (process.env.NUXT_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  app.enableCors({
    origin: isDev ? /^http:\/\/localhost:\d+$/ : allowedOrigins,
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port)
}

bootstrap()
