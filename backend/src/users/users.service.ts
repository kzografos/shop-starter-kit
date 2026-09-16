import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { MEMBER_ROLE } from '../auth/permissions'
import { UserExtensionsRegistry } from './user-extensions.registry'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private extensions: UserExtensionsRegistry,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } })
  }

  // Creates a passwordless user authenticated via an OAuth provider.
  async createOAuthUser(data: {
    email: string
    fullName?: string
    googleId: string
    avatarUrl?: string
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        googleId: data.googleId,
        avatarUrl: data.avatarUrl,
        provider: 'google',
      },
    })
  }

  // Links a Google identity to an existing (e.g. password) account — auto-link by verified email.
  async linkGoogle(id: string, googleId: string, avatarUrl?: string) {
    return this.prisma.user.update({
      where: { id },
      data: { googleId, avatarUrl: avatarUrl ?? undefined },
    })
  }

  async create(email: string, password: string, fullName?: string) {
    const existing = await this.findByEmail(email)
    if (existing) throw new ConflictException('Email already registered')

    const passwordHash = await bcrypt.hash(password, 12)
    return this.prisma.user.create({
      data: { email, passwordHash, fullName },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async updatePassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({ where: { id }, data: { passwordHash } })
  }

  async updateProfile(id: string, data: { fullName?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async verifyPassword(user: { passwordHash: string | null }, password: string) {
    // OAuth-only accounts have no password — reject password login.
    if (!user.passwordHash) return false
    return bcrypt.compare(password, user.passwordHash)
  }

  /**
   * Paginated customer list for the admin panel. Core selects only its own
   * columns; the loyalty balance and the order count the page also shows are
   * merged in by the modules that own them through UserExtensionsRegistry.
   */
  async listCustomers({ page = 1, search }: { page?: number; search?: string } = {}) {
    const PAGE_SIZE = 20
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE
    const where: Prisma.UserWhereInput = {
      role: MEMBER_ROLE,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { fullName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }
    const [customers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          email: true,
          fullName: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return {
      customers: await this.extensions.apply(customers, 'customers'),
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    }
  }

  async getOrThrow(id: string) {
    const user = await this.findById(id)
    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
