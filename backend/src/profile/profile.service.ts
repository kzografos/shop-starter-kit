import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { permissionsFor } from '../auth/permissions'

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  me(user: unknown) {
    const u = (user ?? {}) as { role?: string }
    // Expose admin capabilities so the client can gate nav + routes.
    return { ...u, permissions: permissionsFor(u.role) }
  }

  update(userId: string, dto: { fullName?: string; phone?: string }) {
    return this.users.updateProfile(userId, dto)
  }

  getLoyalty(userId: string) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
