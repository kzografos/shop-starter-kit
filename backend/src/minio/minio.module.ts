import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { isStorageConfigured } from '../core/config/env.validation'
import { MinioService } from './minio.service'
import { MINIO_CLIENT } from './minio.constants'

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      // No client at all when storage is not configured. MinioService treats a
      // null client as "disabled" and rejects use with a clear error instead of
      // Core boot failing on a provider only the shop needs.
      useFactory: (config: ConfigService): Minio.Client | null =>
        isStorageConfigured(config)
          ? new Minio.Client({
              endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
              port: parseInt(config.getOrThrow<string>('MINIO_PORT'), 10),
              useSSL: false,
              accessKey: config.getOrThrow<string>('MINIO_ROOT_USER'),
              secretKey: config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
            })
          : null,
    },
    MinioService,
  ],
  exports: [MinioService],
})
export class MinioModule {}
