import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FavouritesService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.favourite.findMany({
      where: { userId },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async toggle(userId: string, productId: string) {
    const existing = await this.prisma.favourite.findUnique({
      where: { userId_productId: { userId, productId } },
    })
    if (existing) {
      await this.prisma.favourite.delete({ where: { id: existing.id } })
      return { action: 'removed', productId }
    }
    await this.prisma.favourite.create({ data: { userId, productId } })
    return { action: 'added', productId }
  }

  async getIds(userId: string) {
    const favs = await this.prisma.favourite.findMany({
      where: { userId },
      select: { productId: true },
    })
    return favs.map((f) => f.productId)
  }
}
