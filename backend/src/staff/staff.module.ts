import { Module } from '@nestjs/common'
import { PrismaModule } from '../infrastructure/prisma/prisma.module'
import { StaffController } from './staff.controller'
import { StaffService } from './staff.service'

@Module({
  imports: [PrismaModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
