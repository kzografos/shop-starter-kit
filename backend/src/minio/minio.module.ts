import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { MinioService } from './minio.service'
import { MINIO_CLIENT } from './minio.constants'

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Minio.Client({
          endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
          port: parseInt(config.getOrThrow<string>('MINIO_PORT'), 10),
          useSSL: false,
          accessKey: config.getOrThrow<string>('MINIO_ROOT_USER'),
          secretKey: config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
        }),
    },
    MinioService,
  ],
  exports: [MinioService],
})
export class MinioModule {}
