import type { ModuleSeed } from '../../../core/seed/core.seed';

// The e-commerce module's seed (E9e5): the sample catalogue. Development
// fixtures only, so it does nothing unless SEED_DEMO_DATA is on. Registered in
// src/seed.ts; runs only while the module is enabled. Nothing here runs on
// import.
export const seedEcommerce: ModuleSeed = async (prisma, { demo }) => {
  if (!demo) return;

  // ── Categories ───────────────────────────────────────────────
  console.log('Seeding categories...');
  const categoriesBySlug: Record<string, { id: string }> = {};
  for (let n = 1; n <= 10; n++) {
    const slug = `category-${n}`;
    categoriesBySlug[slug] = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { slug, nameEn: `Category Name ${n}`, nameEl: `Κατηγορία ${n}`, sortOrder: n },
    });
  }

  // ── Products ─────────────────────────────────────────────────
  console.log('Seeding products...');
  // Generic sample products. `brand` strings match the homepage marquee
  // (Brand 1–8) so every brand resolves to a real list on /brands.
  // images: [] → cards render the redesigned placeholder via their fallback.
  const productSpecs: Array<{
    n: number; brand: string; categorySlug: string;
    price: number; compareAtPrice?: number; stock: number;
  }> = [
    { n: 1,  brand: 'Brand 1', categorySlug: 'category-1',  price: 19.99, stock: 100 },
    { n: 2,  brand: 'Brand 2', categorySlug: 'category-2',  price: 39.99, compareAtPrice: 49.99, stock: 50 },
    { n: 3,  brand: 'Brand 3', categorySlug: 'category-3',  price: 12.50, stock: 200 },
    { n: 4,  brand: 'Brand 4', categorySlug: 'category-4',  price: 8.99,  stock: 150 },
    { n: 5,  brand: 'Brand 5', categorySlug: 'category-5',  price: 24.99, compareAtPrice: 34.99, stock: 75 },
    { n: 6,  brand: 'Brand 6', categorySlug: 'category-6',  price: 59.99, stock: 30 },
    { n: 7,  brand: 'Brand 7', categorySlug: 'category-7',  price: 45.00, stock: 40 },
    { n: 8,  brand: 'Brand 8', categorySlug: 'category-8',  price: 89.99, stock: 20 },
    { n: 9,  brand: 'Brand 1', categorySlug: 'category-9',  price: 14.99, stock: 120 },
    { n: 10, brand: 'Brand 2', categorySlug: 'category-10', price: 74.50, stock: 25 },
  ];

  for (const s of productSpecs) {
    const slug = `sample-product-${s.n}`;
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        nameEn: `Sample Product ${s.n}`,
        nameEl: `Δείγμα Προϊόντος ${s.n}`,
        descriptionEn: 'A short sample product description.',
        descriptionEl: 'Σύντομη περιγραφή δείγματος προϊόντος.',
        price: s.price,
        ...(s.compareAtPrice ? { compareAtPrice: s.compareAtPrice } : {}),
        stock: s.stock,
        brand: s.brand,
        isActive: true,
        categoryId: categoriesBySlug[s.categorySlug].id,
        images: [],
      },
    });
  }

  console.log('Demo data seeded: 10 categories, 10 products, 8 brands.');
};
