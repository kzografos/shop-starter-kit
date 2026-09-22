import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ParseUUIDPipe } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { StaffService } from './staff.service'
import { CreateStaffDto, ResetStaffPasswordDto, UpdateStaffRoleDto } from './dto/staff.dto'

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('manage:staff')
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list()
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto)
  }

  @Patch(':id/role')
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffRoleDto, @CurrentUser() user: { id: string }) {
    return this.staff.updateRole(id, dto, user.id)
  }

  @Patch(':id/password')
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetStaffPasswordDto) {
    return this.staff.resetPassword(id, dto.password)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.staff.remove(id, user.id)
  }
}
