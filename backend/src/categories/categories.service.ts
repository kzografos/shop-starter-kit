import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findTree() {
    const cacheKey = 'categories:tree'
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const all = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    const parents = all.filter((c) => !c.parentId)
    const result = parents.map((p) => ({
      ...p,
      children: all.filter((c) => c.parentId === p.id),
    }))
    await this.redis.set(cacheKey, JSON.stringify(result), 300)
    return result
  }
}
