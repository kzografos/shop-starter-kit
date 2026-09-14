import { Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { MINIO_CLIENT } from './minio.constants'

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private readonly bucket: string

  constructor(
    // Null when object storage is not configured (see MinioModule).
    @Inject(MINIO_CLIENT) private readonly maybeClient: Minio.Client | null,
    private config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? ''
  }

  /** True when a storage backend is configured and a client exists. */
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

  async uploadFile(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await this.client.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': mimetype })
    return key
  }

  /**
   * Turns stored image references into URLs a browser can load.
   *
   * A product's `images` column holds MinIO object keys, except for rows seeded
   * or imported with an absolute URL, which are passed through untouched.
   * Anything that returns raw keys renders as a broken image.
   */
  async resolveImageUrls(refs: string[], expirySeconds = 3600): Promise<string[]> {
    return Promise.all(
      refs.map((ref) =>
        this.isExternalUrl(ref) ? Promise.resolve(ref) : this.getPresignedUrl(ref, expirySeconds),
      ),
    )
  }

  private isExternalUrl(ref: string): boolean {
    return ref.startsWith('http://') || ref.startsWith('https://')
  }

  async getPresignedUrl(filename: string, expirySeconds: number): Promise<string> {
    const url = await this.client.presignedGetObject(this.bucket, filename, expirySeconds)
    const publicUrl = this.config.get<string>('MINIO_PUBLIC_URL')
    if (publicUrl) {
      const internalBase = `http://${this.config.getOrThrow<string>('MINIO_ENDPOINT')}:${this.config.getOrThrow<string>('MINIO_PORT')}`
      return url.replace(internalBase, publicUrl)
    }
    return url
  }
}
