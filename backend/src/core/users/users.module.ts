import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersAdminController } from './users-admin.controller'
import { UserExtensionsRegistry } from './user-extensions.registry'

@Module({
  controllers: [UsersAdminController],
  // UserExtensionsRegistry: modules register the fields they add to user
  // payloads (blueprint seam 2); Core applies them where users leave for the client.
  providers: [UsersService, UserExtensionsRegistry],
  exports: [UsersService, UserExtensionsRegistry],
})
export class UsersModule {}
