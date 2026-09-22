import { Module } from '@nestjs/common'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './uploads.service'

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  // Exported so the product image sub-resource reuses the same validation.
  exports: [UploadsService],
})
export class UploadsModule {}
