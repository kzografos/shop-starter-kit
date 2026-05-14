import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { SnakeCaseInterceptor } from './common/interceptors/snake-case.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  app.use(helmet())
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalInterceptors(new SnakeCaseInterceptor())

  app.enableCors({
    origin: process.env.NUXT_URL || 'http://localhost:3000',
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}`)
}

bootstrap()
