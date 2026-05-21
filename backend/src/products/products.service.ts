import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { MinioService } from '../minio/minio.service'
import { toCache } from '../common/utils/serialize'
import { Prisma } from '@prisma/client'
import { QueryProductsDto } from './dto/query-products.dto'

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

  async findAll(query: QueryProductsDto) {
    const { page: pageParam, categories, brand, minPrice, maxPrice, animalType, search, sort } = query

    const cacheKey = `products:list:${JSON.stringify(query)}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const page = Math.max(1, pageParam ?? 1)
    const skip = (page - 1) * PAGE_SIZE

    const where: Prisma.ProductWhereInput = { isActive: true }

    const slugs = categories?.length ? categories : []
    if (slugs.length) {
      const categories = await this.prisma.category.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, children: { select: { id: true } } },
      })
      const allIds = categories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)])
      if (allIds.length) where.categoryId = { in: allIds }
    }

    if (brand?.length) where.brand = { in: brand }
    if (animalType) where.animalAge = animalType as any
    if (minPrice !== undefined) where.price = { ...where.price as object, gte: minPrice }
    if (maxPrice !== undefined) where.price = { ...where.price as object, lte: maxPrice }

    if (search) {
      const term = search.trim()
      where.OR = [
        { nameEl: { contains: term, mode: 'insensitive' } },
        { nameEn: { contains: term, mode: 'insensitive' } },
      ]
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }
    if (sort === 'price_asc') orderBy = { price: 'asc' }
    else if (sort === 'price_desc') orderBy = { price: 'desc' }
    else if (sort === 'name_asc') orderBy = { nameEn: 'asc' }
    else if (sort === 'name_desc') orderBy = { nameEn: 'desc' }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
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
