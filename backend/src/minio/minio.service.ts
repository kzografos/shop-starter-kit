import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { MINIO_CLIENT } from './minio.constants'

@Injectable()
export class MinioService implements OnModuleInit {
  private bucket: string

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Minio.Client,
    private config: ConfigService,
  ) {
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET')
  }

  async onModuleInit() {
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
