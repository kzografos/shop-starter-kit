import { Injectable, BadRequestException } from '@nestjs/common'
import { MinioService } from '../minio/minio.service'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 5 * 1024 * 1024

@Injectable()
export class UploadsService {
  constructor(private minio: MinioService) {}

  async uploadImage(file: Express.Multer.File): Promise<{ key: string; url: string }> {
    if (!file) throw new BadRequestException('No file provided')
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds 5 MB limit')
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WebP, GIF allowed')
    const key = await this.minio.uploadFile(file.buffer, file.originalname, file.mimetype)
    const url = await this.minio.getPresignedUrl(key, 3600)
    return { key, url }
  }
}
