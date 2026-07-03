import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg';

async function main() {
  // ── Settings ─────────────────────────────────────────────────
  const settings = [
    { key: 'loyalty_earn_rate', value: '100' },
    { key: 'loyalty_redeem_rate', value: '100' },
    { key: 'loyalty_min_redeem', value: '500' },
    { key: 'shipping_cost', value: '5.00' },
    { key: 'free_shipping_threshold', value: '50.00' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // ── Demo accounts — CHANGE OR REMOVE before production ───────
  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash('admin', 12),
    bcrypt.hash('user', 12),
  ]);
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash: adminHash,
      fullName: 'Demo Admin',
      provider: 'local',
      role: 'ADMIN',
    },
  });
  await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {},
    create: {
      email: 'user@demo.com',
      passwordHash: userHash,
      fullName: 'Demo User',
      provider: 'local',
      role: 'CUSTOMER',
    },
  });

  // ── Categories ───────────────────────────────────────────────
  console.log('Seeding categories...');
  const [category1, category2] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'category-1' },
      update: {},
      create: { slug: 'category-1', nameEn: 'Category Name 1', nameEl: 'Category Name 1', sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'category-2' },
      update: {},
      create: { slug: 'category-2', nameEn: 'Category Name 2', nameEl: 'Category Name 2', sortOrder: 2 },
    }),
  ]);

  // ── Products ─────────────────────────────────────────────────
  console.log('Seeding products...');
  const products = [
    {
      slug: 'sample-product-1',
      nameEn: 'Sample Product 1',
      nameEl: 'Sample Product 1',
      descriptionEn: 'A short sample product description.',
      descriptionEl: 'A short sample product description.',
      price: 19.99,
      stock: 100,
      categoryId: category1.id,
    },
    {
      // On sale — compareAtPrice > price triggers strikethrough display.
      slug: 'sample-product-2',
      nameEn: 'Sample Product 2',
      nameEl: 'Sample Product 2',
      descriptionEn: 'A short sample product description.',
      descriptionEl: 'A short sample product description.',
      price: 39.99,
      compareAtPrice: 49.99,
      stock: 50,
      categoryId: category1.id,
    },
    {
      slug: 'sample-product-3',
      nameEn: 'Sample Product 3',
      nameEl: 'Sample Product 3',
      descriptionEn: 'A short sample product description.',
      descriptionEl: 'A short sample product description.',
      price: 12.50,
      stock: 200,
      categoryId: category2.id,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, isActive: true, images: [PLACEHOLDER_IMAGE] },
    });
  }

  console.log('Seed complete: 2 categories, 3 products, 2 demo users.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
