import { Module } from '@nestjs/common'
import { ProfileController } from './profile.controller'
import { UsersModule } from '../users/users.module'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [UsersModule, PrismaModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
