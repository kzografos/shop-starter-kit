import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { AnimalAge, OrderStatus } from '@prisma/client'

const STATUS_MAP: Record<string, OrderStatus> = {
  pending: OrderStatus.PENDING,
  confirmed: OrderStatus.CONFIRMED,
  processing: OrderStatus.PROCESSING,
  ready: OrderStatus.READY,
  completed: OrderStatus.COMPLETED,
  cancelled: OrderStatus.CANCELLED,
}

const AGE_MAP: Record<string, AnimalAge> = {
  all: AnimalAge.ALL,
  adult: AnimalAge.ADULT,
  puppy: AnimalAge.PUPPY,
  kitten: AnimalAge.KITTEN,
  senior: AnimalAge.SENIOR,
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getStats() {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

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
      orderItems,
      lowStock,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { NOT: { status: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { NOT: { status: OrderStatus.CANCELLED }, createdAt: { gte: monthStart } },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: monthStart } } }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, total: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { NOT: { status: OrderStatus.CANCELLED }, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, total: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.orderItem.findMany({
        take: 500,
        select: {
          productId: true,
          quantity: true,
          product: { select: { nameEl: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { stock: { lt: 5 } },
        orderBy: { stock: 'asc' },
        take: 8,
        select: { id: true, nameEl: true, stock: true },
      }),
    ])

    const productMap = new Map<string, { name: string; units: number }>()
    for (const item of orderItems) {
      if (!item.productId) continue
      const name = item.product?.nameEl ?? item.productId
      const cur = productMap.get(item.productId)
      if (cur) cur.units += item.quantity
      else productMap.set(item.productId, { name, units: item.quantity })
    }

    return {
      totalRevenue: Number(revenueAll._sum.total ?? 0),
      monthRevenue: Number(revenueMonth._sum.total ?? 0),
      totalCustomers,
      newCustomers,
      recentOrders,
      last30Days: last30Orders.map((o) => ({
        date: o.createdAt.toISOString().slice(0, 10),
        total: Number(o.total),
      })),
      orderStatusBreakdown: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      topProducts: Array.from(productMap.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, 5),
      lowStock: lowStock.map((p) => ({ id: p.id, nameEl: p.nameEl, stock: p.stock })),
    }
  }

  async getOrders() {
    return this.prisma.order.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async updateOrderStatus(id: string, status: string) {
    const mapped = STATUS_MAP[status]
    if (!mapped) throw new NotFoundException(`Unknown status: ${status}`)
    return this.prisma.order.update({ where: { id }, data: { status: mapped } })
  }

  async getProducts() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  async createProduct(body: Record<string, unknown>) {
    const product = await this.prisma.product.create({
      data: {
        slug: body.slug as string,
        nameEl: body.name_el as string,
        nameEn: body.name_en as string,
        descriptionEl: body.description_el as string | undefined,
        descriptionEn: body.description_en as string | undefined,
        price: body.price as number,
        stock: body.stock as number,
        brand: body.brand as string | undefined,
        packageSize: body.package_size as string | undefined,
        animalAge: AGE_MAP[body.animal_age as string] ?? AnimalAge.ALL,
        categoryId: (body.category_id as string | null) || null,
        isActive: body.is_active !== false,
        images: (body.images as string[]) ?? [],
      },
    })
    await this.redis.delPattern('products:*')
    return product
  }

  async updateProduct(id: string, body: Record<string, unknown>) {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        slug: body.slug as string,
        nameEl: body.name_el as string,
        nameEn: body.name_en as string,
        descriptionEl: body.description_el as string | undefined,
        descriptionEn: body.description_en as string | undefined,
        price: body.price as number,
        stock: body.stock as number,
        brand: body.brand as string | undefined,
        packageSize: body.package_size as string | undefined,
        animalAge: AGE_MAP[body.animal_age as string] ?? AnimalAge.ALL,
        categoryId: (body.category_id as string | null) || null,
        isActive: body.is_active as boolean,
        images: (body.images as string[]) ?? [],
      },
    })
    await this.redis.delPattern('products:*')
    return product
  }

  async deactivateProduct(id: string) {
    const product = await this.prisma.product.update({ where: { id }, data: { isActive: false } })
    await this.redis.delPattern('products:*')
    return product
  }
}
