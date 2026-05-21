import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  me(user: unknown) {
    return user
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
