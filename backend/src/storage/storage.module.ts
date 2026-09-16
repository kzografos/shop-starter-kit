import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { isStorageConfigured } from '../core/config/env.validation'
import { StorageAdapter } from './storage-adapter'
import { MinioStorageAdapter, MINIO_CLIENT } from './minio-storage.adapter'

// Infrastructure: object storage. Global so any layer can inject
// StorageAdapter; the only implementation today is MinIO (S3-compatible).
@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      // No client at all when storage is not configured. The adapter treats a
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
    MinioStorageAdapter,
    { provide: StorageAdapter, useExisting: MinioStorageAdapter },
  ],
  exports: [StorageAdapter],
})
export class StorageModule {}
