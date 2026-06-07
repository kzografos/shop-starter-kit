import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
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
        compareAtPrice: (body.compare_at_price as number | null) || null,
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
        compareAtPrice: (body.compare_at_price as number | null) || null,
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

  async createCategory(body: Record<string, unknown>) {
    const slug = (body.slug as string)?.trim()
    const nameEl = (body.name_el as string)?.trim()
    const nameEn = (body.name_en as string)?.trim()
    if (!slug || !nameEl || !nameEn)
      throw new BadRequestException('Slug, Greek name and English name are required')

    const exists = await this.prisma.category.findUnique({ where: { slug } })
    if (exists) throw new BadRequestException('A category with this slug already exists')

    const parentId = (body.parent_id as string) || null
    if (parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: parentId } })
      if (!parent) throw new BadRequestException('Parent category not found')
      if (parent.parentId) throw new BadRequestException('Cannot nest under a subcategory (max 2 levels)')
    }

    const cat = await this.prisma.category.create({
      data: { slug, nameEl, nameEn, parentId, sortOrder: Number(body.sort_order) || 0 },
    })
    await this.invalidateCatalog()
    return cat
  }

  async updateCategory(id: string, body: Record<string, unknown>) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })
    if (!cat) throw new NotFoundException('Category not found')

    const parentId = (body.parent_id as string) || null
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
        nameEl: (body.name_el as string)?.trim(),
        nameEn: (body.name_en as string)?.trim(),
        parentId,
        sortOrder: Number(body.sort_order) || 0,
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
