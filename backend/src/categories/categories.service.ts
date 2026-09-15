import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'

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

  // ── Admin (moved unchanged from AdminService) ────────────────

  private async invalidateCatalog() {
    await this.redis.delPattern('products:*')
    await this.redis.del('categories:tree')
  }

  async listForAdmin() {
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

  async create(dto: CreateCategoryDto) {
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

  async update(id: string, dto: UpdateCategoryDto) {
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

  async remove(id: string) {
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
