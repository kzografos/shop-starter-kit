import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Settings
  const settings = [
    { key: 'loyalty_earn_rate', value: '100' },
    { key: 'loyalty_redeem_rate', value: '100' },
    { key: 'loyalty_min_redeem', value: '500' },
    { key: 'shipping_cost', value: '5.00' },
    { key: 'free_shipping_threshold', value: '50.00' },
  ]
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s })
  }

  // Top-level animal categories
  const parents = [
    { slug: 'dogs', nameEl: 'Σκύλος', nameEn: 'Dog', sortOrder: 1 },
    { slug: 'cats', nameEl: 'Γάτα', nameEn: 'Cat', sortOrder: 2 },
    { slug: 'birds', nameEl: 'Πουλιά', nameEn: 'Bird', sortOrder: 3 },
    { slug: 'rodents', nameEl: 'Τρωκτικά', nameEn: 'Rodent', sortOrder: 4 },
  ]
  const parentMap: Record<string, string> = {}
  for (const p of parents) {
    const cat = await prisma.category.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    })
    parentMap[p.slug] = cat.id
  }

  // Sub-categories
  const subs = [
    { slug: 'dog-food', nameEl: 'Τροφές Σκύλων', nameEn: 'Dog Food', parent: 'dogs', sortOrder: 1 },
    { slug: 'dog-accessories', nameEl: 'Αξεσουάρ Σκύλων', nameEn: 'Dog Accessories', parent: 'dogs', sortOrder: 2 },
    { slug: 'dog-treats', nameEl: 'Λιχουδιές Σκύλων', nameEn: 'Dog Treats', parent: 'dogs', sortOrder: 3 },
    { slug: 'cat-food', nameEl: 'Τροφές Γάτων', nameEn: 'Cat Food', parent: 'cats', sortOrder: 1 },
    { slug: 'cat-accessories', nameEl: 'Αξεσουάρ Γάτων', nameEn: 'Cat Accessories', parent: 'cats', sortOrder: 2 },
    { slug: 'cat-treats', nameEl: 'Λιχουδιές Γάτων', nameEn: 'Cat Treats', parent: 'cats', sortOrder: 3 },
    { slug: 'bird-food', nameEl: 'Τροφές Πουλιών', nameEn: 'Bird Food', parent: 'birds', sortOrder: 1 },
    { slug: 'rodent-food', nameEl: 'Τροφές Τρωκτικών', nameEn: 'Rodent Food', parent: 'rodents', sortOrder: 1 },
  ]
  for (const s of subs) {
    await prisma.category.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        nameEl: s.nameEl,
        nameEn: s.nameEn,
        sortOrder: s.sortOrder,
        parentId: parentMap[s.parent],
      },
    })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
