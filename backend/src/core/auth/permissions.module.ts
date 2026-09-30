import { Global, Module } from '@nestjs/common'
import { PermissionsRegistryService } from './permissions.registry.service'

// Global like the other Core registries (CoreEventModule): PermissionsGuard is
// instantiated in whichever module declares the controller, and every module
// registers its own capabilities, so the registry must resolve everywhere
// without each module importing AuthModule.
@Global()
@Module({
  providers: [PermissionsRegistryService],
  exports: [PermissionsRegistryService],
})
export class PermissionsModule {}
