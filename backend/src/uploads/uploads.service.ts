import { Injectable, BadRequestException } from '@nestjs/common'
import { StorageAdapter } from '../infrastructure/storage/storage-adapter'
// Namespace import, not a default import. tsconfig sets
// allowSyntheticDefaultImports but not esModuleInterop: the first only relaxes
// the type checker, it does not emit the interop helper. `import FileType from`
// therefore compiled to `file_type_1.default.fromBuffer(...)`, and file-type@16
// is CommonJS with no default export, so that was undefined at runtime and every
// upload threw. It typechecked cleanly, which is why it survived.
import * as FileType from 'file-type'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 5 * 1024 * 1024

@Injectable()
export class UploadsService {
  constructor(private storage: StorageAdapter) {}

  async uploadImage(file: Express.Multer.File): Promise<{ key: string; url: string }> {
    if (!file) throw new BadRequestException('No file provided')
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds 5 MB limit')
    const detected = await FileType.fromBuffer(file.buffer)
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      throw new BadRequestException(
        `Invalid file type. Detected: ${detected?.mime ?? 'unknown'}`
      )
    }
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WebP, GIF allowed')
    const key = await this.storage.put(file.buffer, file.originalname, file.mimetype)
    const url = await this.storage.presign(key, 3600)
    return { key, url }
  }
}
