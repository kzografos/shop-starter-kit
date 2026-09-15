import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Demo users and the sample catalogue are development fixtures. They are NEVER
// seeded unless SEED_DEMO_DATA is explicitly set to 'true' — production start.sh
// runs this file on every container boot, so an ungated demo admin would be
// recreated after every deploy and could never be permanently deleted.
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === 'true';

// Minimum length for a bootstrapped owner password. The owner account holds every
// capability in the system, so a weak one is refused rather than silently accepted.
const MIN_OWNER_PASSWORD_LENGTH = 12;

/**
 * Baseline settings. These are NOT demo data — orders.service reads every one of
 * them to price an order, and a missing row produces a NaN total. They must exist
 * in every environment, so they seed unconditionally.
 */
async function seedSettings() {
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
  console.log(`Settings ensured (${settings.length} keys).`);
}

/**
 * Creates the store's first owner from OWNER_EMAIL / OWNER_PASSWORD.
 *
 * With demo data gated off, this is the only way a production store gets an
 * account that can sign into the admin panel. It is idempotent and safe to run on
 * every container boot: once any ADMIN exists it does nothing, so it can never
 * resurrect a deleted account or reset a live owner's password.
 */
async function seedOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    const owners = await prisma.user.count({ where: { role: 'admin' } });
    if (owners === 0) {
      console.warn(
        'No owner account exists and OWNER_EMAIL / OWNER_PASSWORD are not set. ' +
        'Nobody can sign into the admin panel. Set both and restart to bootstrap one.',
      );
    }
    return;
  }

  if (password.length < MIN_OWNER_PASSWORD_LENGTH) {
    throw new Error(
      `OWNER_PASSWORD must be at least ${MIN_OWNER_PASSWORD_LENGTH} characters.`,
    );
  }

  const owners = await prisma.user.count({ where: { role: 'admin' } });
  if (owners > 0) {
    console.log('Owner account already exists — leaving it untouched.');
    return;
  }

  // An account may already exist as a CUSTOMER (e.g. the operator shopped first).
  // Promote it rather than failing on the unique email constraint.
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: 'admin', passwordHash },
    create: { email, passwordHash, fullName: 'Owner', provider: 'local', role: 'admin' },
  });
  console.log(`Owner account bootstrapped: ${email}`);
  console.warn(
    [
      '',
      '  ┌────────────────────────────────────────────────────────────────┐',
      '  │  ACTION REQUIRED                                               │',
      '  │                                                                │',
      '  │  Remove OWNER_PASSWORD from .env now, then restart.            │',
      '  │                                                                │',
      '  │  The owner account exists, so this bootstrap will not run      │',
      '  │  again. The password is now dead weight in a plaintext file    │',
      '  │  readable by anything with filesystem access to this host.     │',
      '  │                                                                │',
      '  │  Leaving OWNER_EMAIL set is harmless.                          │',
      '  └────────────────────────────────────────────────────────────────┘',
      '',
    ].join('\n'),
  );
}

async function seedDemoData() {
  // ── Demo accounts — development only ───────────────────────────
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
      role: 'admin',
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
      role: 'customer',
    },
  });

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

  console.log('Demo data seeded: 10 categories, 10 products, 8 brands, 2 demo users.');
}

async function main() {
  await seedSettings();
  await seedOwner();

  if (!SEED_DEMO_DATA) {
    console.log('SEED_DEMO_DATA is not "true" — skipping demo users and sample catalogue.');
    return;
  }

  console.warn('SEED_DEMO_DATA=true — seeding demo accounts with well-known passwords. Never enable this in production.');
  await seedDemoData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
