import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { MinioService } from '../minio/minio.service'
import { toCache } from '../common/utils/serialize'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 12

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private minio: MinioService,
  ) {}

  private isExternalUrl = (s: string) =>
    s.startsWith('http://') || s.startsWith('https://')

  private async resolveImageUrls(images: string[]): Promise<string[]> {
    return Promise.all(
      images.map((key) =>
        this.isExternalUrl(key) ? key : this.minio.getPresignedUrl(key, 3600),
      ),
    )
  }

  async findAll(query: {
    page?: number
    category?: string
    categories?: string[]
    brand?: string
    animalAge?: string
    search?: string
    priceMin?: number
    priceMax?: number
  }) {
    const cacheKey = `products:list:${JSON.stringify(query)}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const page = Math.max(1, query.page ?? 1)
    const skip = (page - 1) * PAGE_SIZE

    const where: Prisma.ProductWhereInput = { isActive: true }

    // Category: resolve slug → parent + children IDs
    const slugs = query.categories?.length
      ? query.categories
      : query.category
        ? [query.category]
        : []

    if (slugs.length) {
      const allIds: string[] = []
      for (const slug of slugs) {
        const parent = await this.prisma.category.findUnique({
          where: { slug },
          include: { children: { select: { id: true } } },
        })
        if (parent) allIds.push(parent.id, ...parent.children.map((c) => c.id))
      }
      if (allIds.length) where.categoryId = { in: allIds }
    }

    if (query.brand) where.brand = query.brand
    if (query.animalAge) where.animalAge = query.animalAge as any
    if (query.priceMin !== undefined) where.price = { ...where.price as object, gte: query.priceMin }
    if (query.priceMax !== undefined) where.price = { ...where.price as object, lte: query.priceMax }

    if (query.search) {
      const term = query.search.trim()
      where.OR = [
        { nameEl: { contains: term, mode: 'insensitive' } },
        { nameEn: { contains: term, mode: 'insensitive' } },
      ]
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.product.count({ where }),
    ])

    const resolved = await Promise.all(
      products.map(async (p) => {
        const images = p.images as string[]
        const thumb = images[0]
          ? [this.isExternalUrl(images[0]) ? images[0] : await this.minio.getPresignedUrl(images[0], 3600)]
          : []
        return { ...p, images: thumb }
      })
    )
    const result = {
      products: resolved,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    }
    await this.redis.set(cacheKey, toCache(result), 30)
    return result
  }

  async findBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: { include: { parent: true } } },
    })
    if (!product || !product.isActive) throw new NotFoundException('Product not found')

    const resolvedImages: string[] = []
    for (const key of product.images as string[]) {
      resolvedImages.push(
        this.isExternalUrl(key) ? key : await this.minio.getPresignedUrl(key, 3600),
      )
    }
    const resolved = { ...product, images: resolvedImages }
    await this.redis.set(cacheKey, toCache(resolved), 60)
    return resolved
  }

  async findRelated(brand: string | null, categoryId: string | null, excludeId: string) {
    if (!brand && !categoryId) return []
    const cacheKey = `products:related:${excludeId}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const result = await this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: excludeId },
        OR: [
          brand ? { brand } : {},
          categoryId ? { categoryId } : {},
        ].filter((o) => Object.keys(o).length > 0),
      },
      include: { category: true },
      take: 4,
      orderBy: { createdAt: 'desc' },
    })
    const resolved = await Promise.all(
      result.map(async (p) => {
        const images = p.images as string[]
        const thumb = images[0]
          ? [this.isExternalUrl(images[0]) ? images[0] : await this.minio.getPresignedUrl(images[0], 3600)]
          : []
        return { ...p, images: thumb }
      })
    )
    await this.redis.set(cacheKey, toCache(resolved), 60)
    return resolved
  }

  async findBrands() {
    const cacheKey = 'products:brands'
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const rows = await this.prisma.product.groupBy({
      by: ['brand'],
      where: { isActive: true, brand: { not: null } },
      _count: { brand: true },
      orderBy: { brand: 'asc' },
    })
    const result = rows.map((r) => ({ brand: r.brand!, count: r._count.brand }))
    await this.redis.set(cacheKey, toCache(result), 30)
    return result
  }
}
