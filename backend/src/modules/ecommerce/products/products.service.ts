import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../../infrastructure/redis/redis.service'
import { StorageAdapter } from '../../../infrastructure/storage/storage-adapter'
import { UploadsService } from '../../../core/uploads/uploads.service'
import { StockAlertsService } from './stock-alerts.service'
import { toCache } from '../../../infrastructure/common/utils/serialize'
import { Prisma } from '@prisma/client'
import { QueryProductsDto } from './dto/query-products.dto'
import { UpsertProductDto } from './dto/product.dto'

const PAGE_SIZE = 12

const isExternalUrl = (ref: string) => ref.startsWith('http://') || ref.startsWith('https://')

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name)

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private storage: StorageAdapter,
    private uploads: UploadsService,
    private stockAlerts: StockAlertsService,
  ) {}

  /** List/related cards show the first image only; the adapter decides key vs URL. */
  private async thumbnail(images: string[]): Promise<string[]> {
    return images[0] ? this.storage.resolve([images[0]]) : []
  }

  async findAll(query: QueryProductsDto) {
    const { page: pageParam, categories, brand, minPrice, maxPrice, search, sort, onSale } = query

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
    if (minPrice !== undefined) where.price = { ...where.price as object, gte: minPrice }
    if (maxPrice !== undefined) where.price = { ...where.price as object, lte: maxPrice }
    // On sale = a "was" price that is higher than the current price.
    if (onSale) where.compareAtPrice = { gt: this.prisma.product.fields.price }

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
        include: { category: { select: { id: true, nameEl: true, nameEn: true, slug: true } } },
        orderBy,
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.product.count({ where }),
    ])

    const resolved = await Promise.all(
      products.map(async (p) => {
        return { ...p, images: await this.thumbnail(p.images as string[]) }
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
      include: {
        category: {
          select: {
            id: true,
            nameEl: true,
            nameEn: true,
            slug: true,
            parent: { select: { id: true, slug: true, nameEl: true, nameEn: true } },
          },
        },
      },
    })
    if (!product || !product.isActive) throw new NotFoundException('Product not found')

    const resolved = { ...product, images: await this.storage.resolve(product.images as string[]) }
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
      include: { category: { select: { id: true, nameEl: true, nameEn: true, slug: true } } },
      take: 4,
      orderBy: { createdAt: 'desc' },
    })
    const resolved = await Promise.all(
      result.map(async (p) => {
        return { ...p, images: await this.thumbnail(p.images as string[]) }
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

  // ── Admin (moved unchanged from AdminService) ────────────────

  async listForAdmin({ page = 1, search, sort, order }: { page?: number; search?: string; sort?: string; order?: 'asc' | 'desc' } = {}) {
    const PAGE_SIZE = 20
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE
    const where = search
      ? {
          OR: [
            { nameEl: { contains: search, mode: 'insensitive' as const } },
            { nameEn: { contains: search, mode: 'insensitive' as const } },
            { brand: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}
    const SORT_MAP: Record<string, string> = {
      name: 'nameEl',
      brand: 'brand',
      price: 'price',
      stock: 'stock',
    }
    const sortField = SORT_MAP[sort ?? ''] ?? 'createdAt'
    const dir = order ?? 'desc'
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { [sortField]: dir }, skip, take: PAGE_SIZE }),
      this.prisma.product.count({ where }),
    ])
    return { products, total, page, totalPages: Math.ceil(total / PAGE_SIZE) }
  }

  async findByIdForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('Product not found')
    // `images` stays the stored object keys: the edit drawer submits this value
    // straight back, so returning presigned URLs here would persist an expiring
    // URL as the permanent reference and every photo would 404 an hour later.
    // Display URLs are a separate field.
    return {
      ...product,
      imageUrls: await this.storage.resolve(product.images),
    }
  }

  /**
   * Maps the validated wire payload onto Prisma columns.
   *
   * Optional text fields arrive as '' from the admin form; those are stored as
   * null so "not set" is one value in the database rather than two.
   */
  private toProductData(dto: UpsertProductDto) {
    return {
      slug: dto.slug,
      nameEl: dto.name_el,
      nameEn: dto.name_en,
      descriptionEl: dto.description_el?.trim() || null,
      descriptionEn: dto.description_en?.trim() || null,
      price: dto.price,
      compareAtPrice: dto.compare_at_price ?? null,
      cost: dto.cost ?? null,
      stock: dto.stock,
      brand: dto.brand?.trim() || null,
      categoryId: dto.category_id || null,
      images: dto.images ?? [],
    }
  }

  /**
   * Drops every cached catalogue read (`products:*`). Owned here so other
   * sub-domains (categories) invalidate through this call, never by pattern
   * string (DEPENDENCY-RULES §6.6).
   */
  async invalidate(): Promise<void> {
    await this.redis.delPattern('products:*')
  }

  async create(dto: UpsertProductDto) {
    const product = await this.prisma.product
      .create({
        data: {
          ...this.toProductData(dto),
          // Absent means active, matching the previous `!== false` behaviour.
          isActive: dto.is_active ?? true,
        },
      })
      .catch((err) => {
        throw this.translateProductWriteError(err, dto.slug)
      })
    await this.invalidate()
    await this.stockAlerts.checkStock(product)
    return product
  }

  async update(id: string, dto: UpsertProductDto) {
    // Remember the current references so objects the update drops can be
    // cleaned up once the row is saved. A missing product still fails in the
    // update below, exactly as before.
    const before = await this.prisma.product.findUnique({ where: { id }, select: { images: true } })
    const product = await this.prisma.product
      .update({
        where: { id },
        data: {
          ...this.toProductData(dto),
          isActive: dto.is_active ?? true,
        },
      })
      .catch((err) => {
        throw this.translateProductWriteError(err, dto.slug)
      })
    await this.invalidate()
    await this.stockAlerts.checkStock(product)
    if (before) await this.pruneOrphans(before.images.filter((ref) => !product.images.includes(ref)))
    return product
  }

  // ── Product images (sub-resource of the admin product) ────────
  // `Product.images` is the single source of truth: array order is display
  // order and index 0 is the primary image. These operations rewrite the
  // array; object cleanup is best-effort and never fails the row update.

  /** Stores an uploaded file through the Core upload validation and appends it. */
  async addImage(id: string, file: Express.Multer.File) {
    const images = await this.imagesOf(id)
    const { key } = await this.uploads.uploadImage(file)
    if (images.includes(key)) throw new BadRequestException('Image is already attached to this product')
    return this.saveImages(id, [...images, key])
  }

  /** Replaces the order: the same references the product holds, reordered. */
  async reorderImages(id: string, images: string[]) {
    const current = await this.imagesOf(id)
    const same =
      images.length === current.length && images.every((ref) => current.includes(ref))
    if (!same) throw new BadRequestException("images must contain exactly the product's current images")
    return this.saveImages(id, images)
  }

  /** Detaches one reference; the stored object is removed if nothing else uses it. */
  async removeImage(id: string, ref: string) {
    const images = await this.imagesOf(id)
    if (!images.includes(ref)) throw new NotFoundException('Image not found on this product')
    const result = await this.saveImages(id, images.filter((r) => r !== ref))
    await this.pruneOrphans([ref])
    return result
  }

  private async imagesOf(id: string): Promise<string[]> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { images: true } })
    if (!product) throw new NotFoundException('Product not found')
    return product.images
  }

  private async saveImages(id: string, images: string[]) {
    const product = await this.prisma.product.update({ where: { id }, data: { images }, select: { images: true } })
    await this.invalidate()
    return { images: product.images, imageUrls: await this.storage.resolve(product.images) }
  }

  /**
   * Deletes stored objects that no product references any more. Absolute URLs
   * are never ours to delete. Storage failures (including "not configured")
   * are logged and swallowed: the database is the source of truth and the row
   * has already been saved.
   */
  private async pruneOrphans(refs: string[]) {
    for (const ref of refs) {
      if (isExternalUrl(ref)) continue
      const stillUsed = await this.prisma.product.count({ where: { images: { has: ref } } })
      if (stillUsed > 0) continue
      try {
        await this.storage.remove(ref)
      } catch (err) {
        this.logger.warn(`Could not delete stored image "${ref}": ${(err as Error).message}`)
      }
    }
  }

  /**
   * Turns Prisma's write failures into messages the admin panel can show.
   * A duplicate slug previously surfaced as a raw 500 with no indication of
   * which field was at fault.
   */
  private translateProductWriteError(err: unknown, slug: string): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return new BadRequestException(`A product with the slug "${slug}" already exists`)
      }
      if (err.code === 'P2025') {
        return new NotFoundException('Product not found')
      }
      if (err.code === 'P2003') {
        return new BadRequestException('The selected category no longer exists')
      }
    }
    return err instanceof Error ? err : new Error(String(err))
  }

  async deactivate(id: string) {
    const product = await this.prisma.product.update({ where: { id }, data: { isActive: false } })
    await this.invalidate()
    return product
  }
}
