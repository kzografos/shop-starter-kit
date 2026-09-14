import { Global, Module } from '@nestjs/common'
import { CoreEventBus } from './core-event-bus.service'

// Global like the other cross-cutting Core providers (Prisma, Redis, Mail):
// any module may subscribe or emit without importing this module explicitly.
@Global()
@Module({
  providers: [CoreEventBus],
  exports: [CoreEventBus],
})
export class CoreEventModule {}
