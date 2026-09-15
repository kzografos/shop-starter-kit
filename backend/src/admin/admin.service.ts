import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { UpsertProductDto } from './dto/product.dto'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import { MinioService } from '../minio/minio.service'

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: PaymentStatus.PENDING,
  paid: PaymentStatus.PAID,
  failed: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
}

// A search term made only of hex digits and dashes is treated as an order-id
// prefix. Anchored and length-capped so it cannot be used to smuggle anything
// into the LIKE pattern below.
const UUID_PREFIX = /^[0-9a-f-]{1,36}$/i

const STATUS_MAP: Record<string, OrderStatus> = {
  pending: OrderStatus.PENDING,
  confirmed: OrderStatus.CONFIRMED,
  processing: OrderStatus.PROCESSING,
  ready: OrderStatus.READY,
  completed: OrderStatus.COMPLETED,
  cancelled: OrderStatus.CANCELLED,
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notifications: NotificationsService,
    private minio: MinioService,
  ) {}

  async getStats() {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const prevMonthStart = new Date(monthStart)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const [
      revenueAll,
      revenueMonth,
      totalCustomers,
      newCustomers,
      recentOrders,
      last30Orders,
      statusGroups,
      topProductRows,
      lowStock,
      prevMonthRevenue,
      prevMonthNewCustomers,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: PaymentStatus.PAID },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: monthStart } },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: monthStart } } }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, total: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, total: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      // Top sellers, aggregated in the database.
      //
      // This was findMany({ take: 500 }) with no orderBy and no filter, summed
      // in JS: an arbitrary 500 rows in whatever order Postgres returned them,
      // across all time and including unpaid orders. Past 500 line items ever
      // sold the figures were simply wrong, and the card is labelled "by units
      // sold this month".
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          order: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: monthStart } },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: { stock: { lt: 5 } },
        orderBy: { stock: 'asc' },
        take: 8,
        select: { id: true, nameEl: true, stock: true },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: prevMonthStart, lt: monthStart } },
      }),
    ])

    const pctChange = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0

    // groupBy cannot join, so resolve the five names in one follow-up query.
    const topProductIds = topProductRows.map((r) => r.productId).filter((id): id is string => !!id)
    const topProductNames = topProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, nameEl: true },
        })
      : []
    const nameById = new Map(topProductNames.map((p) => [p.id, p.nameEl]))

    return {
      totalRevenue: Number(revenueAll._sum.total ?? 0),
      monthRevenue: Number(revenueMonth._sum.total ?? 0),
      monthRevenueChange: pctChange(Number(revenueMonth._sum.total ?? 0), Number(prevMonthRevenue._sum.total ?? 0)),
      totalCustomers,
      newCustomers,
      newCustomersChange: pctChange(newCustomers, prevMonthNewCustomers),
      recentOrders,
      last30Days: last30Orders.map((o) => ({
        date: o.createdAt.toISOString().slice(0, 10),
        total: Number(o.total),
      })),
      orderStatusBreakdown: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      topProducts: topProductRows.map((row) => ({
        // Falls back to the id if the product has since been deleted.
        name: nameById.get(row.productId!) ?? row.productId!,
        units: row._sum.quantity ?? 0,
      })),
      lowStock: lowStock.map((p) => ({ id: p.id, nameEl: p.nameEl, stock: p.stock })),
    }
  }

  /**
   * Paginated order list. This previously returned every order ever placed in
   * one unbounded query, which the client then filtered in memory -- fine at
   * demo scale, progressively slower for a real shop and eventually a timeout.
   *
   * Search and the payment-status filter moved server-side with it, since
   * filtering one page in the browser would otherwise only ever search the page
   * you happen to be looking at.
   */
  async getOrders({ page = 1, search, paymentStatus }: {
    page?: number
    search?: string
    paymentStatus?: string
  } = {}) {
    const PAGE_SIZE = 25
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE

    const where: Prisma.OrderWhereInput = {}

    const mappedPayment = PAYMENT_STATUS_MAP[paymentStatus ?? '']
    if (mappedPayment) where.paymentStatus = mappedPayment

    const term = search?.trim()
    if (term) {
      // Staff see an order as the first 8 characters of its uuid, so a prefix
      // has to match. Prisma types a uuid column as UuidFilter, which has no
      // startsWith, so the ids are resolved separately and fed back in as an
      // `in` list. The extra query only runs when the term looks like hex.
      let idMatches: string[] = []
      if (UUID_PREFIX.test(term)) {
        const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM orders WHERE id::text LIKE ${`${term.toLowerCase()}%`} LIMIT 100
        `
        idMatches = rows.map((r) => r.id)
      }

      where.OR = [
        ...(idMatches.length ? [{ id: { in: idMatches } }] : []),
        { guestEmail: { contains: term, mode: 'insensitive' as const } },
        { user: { email: { contains: term, mode: 'insensitive' as const } } },
        { user: { fullName: { contains: term, mode: 'insensitive' as const } } },
      ]
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where }),
    ])

    return { orders, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
  }

  async updateOrderStatus(id: string, status: string) {
    const mapped = STATUS_MAP[status]
    if (!mapped) throw new NotFoundException(`Unknown status: ${status}`)
    return this.prisma.order.update({ where: { id }, data: { status: mapped } })
  }

  async getProducts({ page = 1, search, sort, order }: { page?: number; search?: string; sort?: string; order?: 'asc' | 'desc' } = {}) {
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

  // ── Customers ──────────────────────────────────────────────

  async getCustomers({ page = 1, search }: { page?: number; search?: string } = {}) {
    const PAGE_SIZE = 20
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE
    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
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
          loyaltyPoints: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return { customers, total, page, totalPages: Math.ceil(total / PAGE_SIZE) }
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('Product not found')
    // `images` stays the stored object keys: the edit drawer submits this value
    // straight back, so returning presigned URLs here would persist an expiring
    // URL as the permanent reference and every photo would 404 an hour later.
    // Display URLs are a separate field.
    return {
      ...product,
      imageUrls: await this.minio.resolveImageUrls(product.images),
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

  async createProduct(dto: UpsertProductDto) {
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
    await this.redis.delPattern('products:*')
    await this.notifications.checkStock(product)
    return product
  }

  async updateProduct(id: string, dto: UpsertProductDto) {
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
    await this.redis.delPattern('products:*')
    await this.notifications.checkStock(product)
    return product
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

  async deactivateProduct(id: string) {
    const product = await this.prisma.product.update({ where: { id }, data: { isActive: false } })
    await this.redis.delPattern('products:*')
    return product
  }

  // ── Categories ─────────────────────────────────────────────

  private async invalidateCatalog() {
    await this.redis.delPattern('products:*')
    await this.redis.del('categories:tree')
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameEl: true,
        nameEn: true,
        parentId: true,
        sortOrder: true,
        _count: { select: { products: true, children: true } },
      },
    })
  }

  async createCategory(dto: CreateCategoryDto) {
    // Shape validation (required, length, slug format) is handled by the DTO.
    // What remains here needs a database read.
    const slug = dto.slug.trim()
    const nameEl = dto.name_el.trim()
    const nameEn = dto.name_en.trim()

    const exists = await this.prisma.category.findUnique({ where: { slug } })
    if (exists) throw new BadRequestException('A category with this slug already exists')

    const parentId = dto.parent_id || null
    if (parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: parentId } })
      if (!parent) throw new BadRequestException('Parent category not found')
      if (parent.parentId) throw new BadRequestException('Cannot nest under a subcategory (max 2 levels)')
    }

    const cat = await this.prisma.category.create({
      data: { slug, nameEl, nameEn, parentId, sortOrder: dto.sort_order ?? 0 },
    })
    await this.invalidateCatalog()
    return cat
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })
    if (!cat) throw new NotFoundException('Category not found')

    const parentId = dto.parent_id || null
    if (parentId === id) throw new BadRequestException('A category cannot be its own parent')
    if (parentId) {
      if (cat._count.children > 0)
        throw new BadRequestException('This category has subcategories; it cannot become a subcategory')
      const parent = await this.prisma.category.findUnique({ where: { id: parentId } })
      if (!parent) throw new BadRequestException('Parent category not found')
      if (parent.parentId) throw new BadRequestException('Cannot nest under a subcategory (max 2 levels)')
    }

    // Slug is locked after creation — intentionally ignored here.
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        nameEl: dto.name_el.trim(),
        nameEn: dto.name_en.trim(),
        parentId,
        sortOrder: dto.sort_order ?? 0,
      },
    })
    await this.invalidateCatalog()
    return updated
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    })
    if (!cat) throw new NotFoundException('Category not found')
    if (cat._count.products > 0 || cat._count.children > 0)
      throw new BadRequestException('Cannot delete a category that still has products or subcategories')

    await this.prisma.category.delete({ where: { id } })
    await this.invalidateCatalog()
    return { ok: true }
  }
}
