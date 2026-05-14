import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        loyaltyPoints: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
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
        loyaltyPoints: true,
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
        loyaltyPoints: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async verifyPassword(user: { passwordHash: string }, password: string) {
    return bcrypt.compare(password, user.passwordHash)
  }

  async getOrThrow(id: string) {
    const user = await this.findById(id)
    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
