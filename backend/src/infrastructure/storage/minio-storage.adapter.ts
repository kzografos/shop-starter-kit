import { Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { StorageAdapter } from './storage-adapter'

export const MINIO_CLIENT = 'MINIO_CLIENT'

/** Default lifetime of a presigned URL, matching what every caller used before. */
export const DEFAULT_PRESIGN_SECONDS = 3600

@Injectable()
export class MinioStorageAdapter extends StorageAdapter implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageAdapter.name)
  private readonly bucket: string

  constructor(
    // Null when object storage is not configured (see StorageModule).
    @Inject(MINIO_CLIENT) private readonly maybeClient: Minio.Client | null,
    private config: ConfigService,
  ) {
    super()
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? ''
  }

  get isEnabled(): boolean {
    return this.maybeClient !== null
  }

  // Every storage operation goes through here, so a disabled provider fails
  // with one clear, non-fatal error instead of a null dereference.
  private get client(): Minio.Client {
    if (!this.maybeClient) {
      throw new ServiceUnavailableException('Object storage is not configured')
    }
    return this.maybeClient
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('Object storage not configured — uploads and image resolution are unavailable')
      return
    }
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket)
    }
  }

  async put(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await this.client.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': mimetype })
    return key
  }

  /**
   * A product's `images` column holds object keys, except for rows seeded or
   * imported with an absolute URL, which are passed through untouched.
   * Anything that returns raw keys renders as a broken image.
   */
  async resolve(refs: readonly string[], expirySeconds = DEFAULT_PRESIGN_SECONDS): Promise<string[]> {
    return Promise.all(
      refs.map((ref) =>
        this.isExternalUrl(ref) ? Promise.resolve(ref) : this.presign(ref, expirySeconds),
      ),
    )
  }

  private isExternalUrl(ref: string): boolean {
    return ref.startsWith('http://') || ref.startsWith('https://')
  }

  async presign(key: string, expirySeconds: number): Promise<string> {
    const url = await this.client.presignedGetObject(this.bucket, key, expirySeconds)
    const publicUrl = this.config.get<string>('MINIO_PUBLIC_URL')
    if (publicUrl) {
      const internalBase = `http://${this.config.getOrThrow<string>('MINIO_ENDPOINT')}:${this.config.getOrThrow<string>('MINIO_PORT')}`
      return url.replace(internalBase, publicUrl)
    }
    return url
  }

  async remove(key: string): Promise<void> {
    // S3-style delete is idempotent: a missing object returns success.
    await this.client.removeObject(this.bucket, key)
  }
}
