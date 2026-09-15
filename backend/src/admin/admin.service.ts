import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PaymentStatus, Prisma } from '@prisma/client'
import { UpsertProductDto } from './dto/product.dto'
import { MinioService } from '../minio/minio.service'

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

}
