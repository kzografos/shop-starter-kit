import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { MINIO_CLIENT } from './minio.constants'

@Injectable()
export class MinioService implements OnModuleInit {
  private bucket: string
  private publicUrl: string

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Minio.Client,
    private config: ConfigService,
  ) {
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET')
    this.publicUrl = this.config.getOrThrow<string>('MINIO_PUBLIC_URL')
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket)
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      })
      await this.client.setBucketPolicy(this.bucket, policy)
    }
  }

  async uploadFile(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await this.client.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': mimetype })
    return `${this.publicUrl}/${this.bucket}/${key}`
  }
}
