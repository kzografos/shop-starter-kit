import { Controller, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { AdminService } from './admin.service'

// No routes remain: each admin surface is served by its owning module's
// admin/* controller. Left in place for the cleanup step.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}
}
