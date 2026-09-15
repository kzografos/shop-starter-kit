import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { MEMBER_ROLE, OWNER_ROLE } from '../auth/permissions'
import { PermissionsRegistryService } from '../auth/permissions.registry.service'
import type { CreateStaffDto, UpdateStaffRoleDto } from './dto/staff.dto'

const STAFF_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  provider: true,
  createdAt: true,
} as const

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsRegistryService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: { in: this.permissions.staffRoles() } },
      select: STAFF_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async create(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException('A user with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    return this.prisma.user.create({
      data: { email, fullName: dto.fullName?.trim() || null, passwordHash, role: dto.role, provider: 'local' },
      select: STAFF_SELECT,
    })
  }

  async updateRole(id: string, dto: UpdateStaffRoleDto, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException('You cannot change your own role')
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) throw new NotFoundException('Staff member not found')
    await this.guardLastOwner(id, target.role, dto.role)
    return this.prisma.user.update({ where: { id }, data: { role: dto.role }, select: STAFF_SELECT })
  }

  async resetPassword(id: string, password: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!target) throw new NotFoundException('Staff member not found')
    const passwordHash = await bcrypt.hash(password, 12)
    await this.prisma.user.update({ where: { id }, data: { passwordHash } })
    return { ok: true }
  }

  /** Remove staff access by demoting back to a regular customer (keeps history). */
  async remove(id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException('You cannot remove yourself')
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) throw new NotFoundException('Staff member not found')
    await this.guardLastOwner(id, target.role, MEMBER_ROLE)
    await this.prisma.user.update({ where: { id }, data: { role: MEMBER_ROLE } })
    return { ok: true }
  }

  /** Block demoting/removing the final remaining owner so the shop is never locked out. */
  private async guardLastOwner(id: string, currentRole: string, nextRole: string) {
    if (currentRole === OWNER_ROLE && nextRole !== OWNER_ROLE) {
      const owners = await this.prisma.user.count({ where: { role: OWNER_ROLE } })
      if (owners <= 1) throw new BadRequestException('Cannot remove the last owner')
    }
  }
}
