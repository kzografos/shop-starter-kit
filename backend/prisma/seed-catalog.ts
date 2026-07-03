/**
 * Idempotent catalog alignment — safe to re-run, never wipes existing data.
 *  - adds Fish + Beds parents and their subcategories (with demo products)
 *  - adds a few real-brand demo products (Schesir, Bravery, Taste of the Wild, Faunakram)
 *  - renames the Rodent parent display to "Rabbit / Hamster / Rodents"
 *  - deletes the 8 empty duplicate leaf categories (0 products) left by the old seed
 *
 * Run:  npx prisma db seed  (or)  ts-node prisma/seed-catalog.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const IMG = {
  dog: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500',
  cat: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500',
  fish: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=500',
}

async function upsertCategory(data: {
  slug: string; nameEl: string; nameEn: string; parentId?: string; sortOrder: number
}) {
  return prisma.category.upsert({
    where: { slug: data.slug },
    update: { nameEl: data.nameEl, nameEn: data.nameEn, parentId: data.parentId, sortOrder: data.sortOrder },
    create: data,
  })
}

async function main() {
  // ── 1. Rename Rodent parent display ──────────────────────────
  await prisma.category.updateMany({
    where: { slug: 'rodents' },
    data: { nameEl: 'Κουνέλι / Χάμστερ / Τρωκτικά', nameEn: 'Rabbit / Hamster / Rodents' },
  })

  // ── 2. New parents ───────────────────────────────────────────
  const fish = await upsertCategory({ slug: 'fish', nameEl: 'Ψάρια', nameEn: 'Fish', sortOrder: 5 })
  const beds = await upsertCategory({ slug: 'beds', nameEl: 'Κρεβάτια', nameEn: 'Beds', sortOrder: 6 })

  // ── 3. New subcategories ─────────────────────────────────────
  const fishFood = await upsertCategory({ slug: 'fish-food', nameEl: 'Τροφές Ψαριών', nameEn: 'Fish Food', parentId: fish.id, sortOrder: 1 })
  const fishAcc = await upsertCategory({ slug: 'fish-accessories', nameEl: 'Αξεσουάρ Ενυδρείου', nameEn: 'Aquarium Accessories', parentId: fish.id, sortOrder: 2 })
  const dogBeds = await upsertCategory({ slug: 'dog-beds', nameEl: 'Κρεβάτια Σκύλων', nameEn: 'Dog Beds', parentId: beds.id, sortOrder: 1 })
  const catBeds = await upsertCategory({ slug: 'cat-beds', nameEl: 'Κρεβάτια Γάτων', nameEn: 'Cat Beds', parentId: beds.id, sortOrder: 2 })

  // ── 4. Demo products for the new categories ──────────────────
  const demo = [
    // Fish Food
    { slug: 'tetra-goldfish-flakes-100g', nameEl: 'Tetra Goldfish Νιφάδες 100g', nameEn: 'Tetra Goldfish Flakes 100g', descriptionEl: 'Πλήρης τροφή σε νιφάδες για χρυσόψαρα και ψυχρόνερα ψάρια.', descriptionEn: 'Complete flake food for goldfish and coldwater fish.', price: 5.50, stock: 60, categoryId: fishFood.id, brand: 'Tetra', img: IMG.fish },
    { slug: 'sera-vipan-tropical-flakes-250ml', nameEl: 'Sera Vipan Τροπικές Νιφάδες 250ml', nameEn: 'Sera Vipan Tropical Flakes 250ml', descriptionEl: 'Βασική τροφή σε νιφάδες για όλα τα τροπικά ψάρια ενυδρείου.', descriptionEn: 'Staple flake food for all tropical aquarium fish.', price: 7.90, stock: 45, categoryId: fishFood.id, brand: 'Sera', img: IMG.fish },
    { slug: 'jbl-novogranomix-250ml', nameEl: 'JBL NovoGranoMix 250ml', nameEn: 'JBL NovoGranoMix 250ml', descriptionEl: 'Μείγμα κόκκων για μικρά ψάρια ενυδρείου.', descriptionEn: 'Granule mix for small aquarium fish.', price: 6.50, stock: 50, categoryId: fishFood.id, brand: 'JBL', img: IMG.fish },
    { slug: 'tetra-pleco-tablets-120t', nameEl: 'Tetra Pleco Ταμπλέτες 120τμχ', nameEn: 'Tetra Pleco Tablets 120pcs', descriptionEl: 'Ταμπλέτες βυθού με φυτικές ίνες για ψάρια καθαριστές.', descriptionEn: 'Sinking tablets with vegetable fibre for bottom-feeders.', price: 8.20, stock: 40, categoryId: fishFood.id, brand: 'Tetra', img: IMG.fish },
    { slug: 'sera-marin-granules-100ml', nameEl: 'Sera Marin Κόκκοι 100ml', nameEn: 'Sera Marin Granules 100ml', descriptionEl: 'Κόκκοι για θαλασσινά ψάρια ενυδρείου.', descriptionEn: 'Granules for marine aquarium fish.', price: 9.50, stock: 35, categoryId: fishFood.id, brand: 'Sera', img: IMG.fish },
    // Fish Accessories
    { slug: 'aquarium-internal-filter-200l', nameEl: 'Εσωτερικό Φίλτρο Ενυδρείου 200L', nameEn: 'Aquarium Internal Filter 200L', descriptionEl: 'Εσωτερικό φίλτρο για ενυδρεία έως 200L με ρυθμιζόμενη ροή.', descriptionEn: 'Internal filter for aquariums up to 200L with adjustable flow.', price: 24.90, stock: 25, categoryId: fishAcc.id, brand: 'JBL', img: IMG.fish },
    { slug: 'led-aquarium-light-60cm', nameEl: 'Φωτιστικό LED Ενυδρείου 60cm', nameEn: 'LED Aquarium Light 60cm', descriptionEl: 'Φωτιστικό LED πλήρους φάσματος για ενυδρεία 60cm.', descriptionEn: 'Full-spectrum LED light for 60cm aquariums.', price: 32.00, stock: 20, categoryId: fishAcc.id, brand: 'Sera', img: IMG.fish },
    { slug: 'aquarium-heater-100w', nameEl: 'Θερμαντήρας Ενυδρείου 100W', nameEn: 'Aquarium Heater 100W', descriptionEl: 'Ρυθμιζόμενος θερμαντήρας 100W για ενυδρεία έως 100L.', descriptionEn: 'Adjustable 100W heater for aquariums up to 100L.', price: 16.50, stock: 30, categoryId: fishAcc.id, brand: 'Tetra', img: IMG.fish },
    { slug: 'water-conditioner-250ml', nameEl: 'Βελτιωτικό Νερού 250ml', nameEn: 'Water Conditioner 250ml', descriptionEl: 'Εξουδετερώνει χλώριο και βαρέα μέταλλα από το νερό βρύσης.', descriptionEn: 'Neutralises chlorine and heavy metals from tap water.', price: 7.50, stock: 55, categoryId: fishAcc.id, brand: 'Sera', img: IMG.fish },
    { slug: 'aquarium-fish-net-medium', nameEl: 'Απόχη Ενυδρείου Medium', nameEn: 'Aquarium Fish Net Medium', descriptionEl: 'Λεπτή απόχη για ασφαλή μεταφορά ψαριών.', descriptionEn: 'Fine net for safely handling fish.', price: 3.50, stock: 70, categoryId: fishAcc.id, brand: 'JBL', img: IMG.fish },
    // Dog Beds
    { slug: 'orthopedic-dog-bed-large', nameEl: 'Ορθοπεδικό Κρεβάτι Σκύλου Large', nameEn: 'Orthopedic Dog Bed Large', descriptionEl: 'Ορθοπεδικό κρεβάτι με αφρό μνήμης για μεγαλόσωμους σκύλους.', descriptionEn: 'Memory-foam orthopedic bed for large dogs.', price: 49.90, stock: 20, categoryId: dogBeds.id, brand: 'Trixie', img: IMG.dog },
    { slug: 'donut-dog-bed-medium', nameEl: 'Στρογγυλό Κρεβάτι Σκύλου Medium', nameEn: 'Donut Dog Bed Medium', descriptionEl: 'Αφράτο στρογγυλό κρεβάτι για αίσθηση ασφάλειας.', descriptionEn: 'Fluffy donut bed for a sense of security.', price: 29.90, stock: 28, categoryId: dogBeds.id, brand: 'Trixie', img: IMG.dog },
    { slug: 'waterproof-dog-mattress-l', nameEl: 'Αδιάβροχο Στρώμα Σκύλου Large', nameEn: 'Waterproof Dog Mattress Large', descriptionEl: 'Αδιάβροχο στρώμα με αφαιρούμενο πλενόμενο κάλυμμα.', descriptionEn: 'Waterproof mattress with removable washable cover.', price: 39.90, stock: 18, categoryId: dogBeds.id, brand: 'Trixie', img: IMG.dog },
    { slug: 'cooling-dog-mat-m', nameEl: 'Δροσιστικό Στρωματάκι Σκύλου Medium', nameEn: 'Cooling Dog Mat Medium', descriptionEl: 'Δροσιστικό στρωματάκι gel για τις ζεστές μέρες.', descriptionEn: 'Gel cooling mat for hot days.', price: 19.90, stock: 35, categoryId: dogBeds.id, brand: 'Trixie', img: IMG.dog },
    { slug: 'plush-dog-bed-small', nameEl: 'Βελούδινο Κρεβάτι Σκύλου Small', nameEn: 'Plush Dog Bed Small', descriptionEl: 'Απαλό βελούδινο κρεβάτι για μικρόσωμους σκύλους.', descriptionEn: 'Soft plush bed for small dogs.', price: 22.50, stock: 30, categoryId: dogBeds.id, brand: 'Trixie', img: IMG.dog },
    // Cat Beds
    { slug: 'cat-cave-bed-felt', nameEl: 'Κρεβάτι-Σπηλιά Γάτας Τσόχα', nameEn: 'Felt Cat Cave Bed', descriptionEl: 'Ζεστό κρεβάτι-σπηλιά από τσόχα για αίσθηση ασφάλειας.', descriptionEn: 'Cosy felt cave bed for a sense of security.', price: 27.90, stock: 24, categoryId: catBeds.id, brand: 'Trixie', img: IMG.cat },
    { slug: 'window-cat-hammock', nameEl: 'Αιώρα Παραθύρου Γάτας', nameEn: 'Window Cat Hammock', descriptionEl: 'Αιώρα με βεντούζες που στηρίζεται στο τζάμι.', descriptionEn: 'Suction-cup hammock that mounts on the window.', price: 17.50, stock: 32, categoryId: catBeds.id, brand: 'Trixie', img: IMG.cat },
    { slug: 'plush-cat-bed-round', nameEl: 'Βελούδινο Στρογγυλό Κρεβάτι Γάτας', nameEn: 'Plush Round Cat Bed', descriptionEl: 'Απαλό στρογγυλό κρεβάτι για ύπνο και ξεκούραση.', descriptionEn: 'Soft round bed for sleeping and lounging.', price: 21.90, stock: 30, categoryId: catBeds.id, brand: 'Trixie', img: IMG.cat },
    { slug: 'heated-cat-bed', nameEl: 'Θερμαινόμενο Κρεβάτι Γάτας', nameEn: 'Heated Cat Bed', descriptionEl: 'Κρεβάτι με αυτοθερμαινόμενη επένδυση για ζεστασιά.', descriptionEn: 'Bed with self-heating lining for warmth.', price: 34.90, stock: 16, categoryId: catBeds.id, brand: 'Trixie', img: IMG.cat },
    { slug: 'cat-tunnel-bed', nameEl: 'Κρεβάτι-Τούνελ Γάτας', nameEn: 'Cat Tunnel Bed', descriptionEl: 'Συνδυασμός κρεβατιού και τούνελ για παιχνίδι και ύπνο.', descriptionEn: 'Combined bed and tunnel for play and sleep.', price: 25.50, stock: 22, categoryId: catBeds.id, brand: 'Trixie', img: IMG.cat },
  ]

  // Real-brand demo products into existing leaves (factual names/prices from the shop's public menu).
  const catsFood = await prisma.category.findUnique({ where: { slug: 'cats-food' }, select: { id: true } })
  const dogsFood = await prisma.category.findUnique({ where: { slug: 'dogs-food' }, select: { id: true } })
  const catsTreats = await prisma.category.findUnique({ where: { slug: 'cats-treats' }, select: { id: true } })

  const realBrands = [
    catsFood && { slug: 'schesir-kitten-care-150gr', nameEl: 'Schesir Kitten Care 150gr', nameEn: 'Schesir Kitten Care 150gr', descriptionEl: 'Υγρή τροφή για γατάκια με κοτόπουλο.', descriptionEn: 'Wet food for kittens with chicken.', price: 3.30, stock: 60, categoryId: catsFood.id, brand: 'Schesir', img: IMG.cat },
    dogsFood && { slug: 'bravery-mini-adult-salmon-2kg', nameEl: 'Bravery Mini Adult Σολομός 2kg', nameEn: 'Bravery Mini Adult Salmon 2kg', descriptionEl: 'Ξηρή τροφή για ενήλικους σκύλους μικρής φυλής με σολομό.', descriptionEn: 'Dry food for small-breed adult dogs with salmon.', price: 22.50, stock: 40, categoryId: dogsFood.id, brand: 'Bravery', img: IMG.dog },
    dogsFood && { slug: 'taste-of-the-wild-puppy-beef-stew-390gr', nameEl: 'Taste of the Wild Puppy Beef Stew 390gr', nameEn: 'Taste of the Wild Puppy Beef Stew 390gr', descriptionEl: 'Υγρή τροφή για κουτάβια με μοσχάρι.', descriptionEn: 'Wet food for puppies with beef.', price: 3.20, stock: 50, categoryId: dogsFood.id, brand: 'Taste of the Wild', img: IMG.dog },
    catsTreats && { slug: 'faunakram-antihairball-75gr', nameEl: 'Faunakram Antihairball 75gr', nameEn: 'Faunakram Antihairball 75gr', descriptionEl: 'Λιχουδιές κατά των τριχόμπαλων για γάτες.', descriptionEn: 'Anti-hairball treats for cats.', price: 5.00, stock: 55, categoryId: catsTreats.id, brand: 'Faunakram', img: IMG.cat },
  ].filter(Boolean) as Array<typeof demo[number]>

  const allProducts = [...demo, ...realBrands].map((p) => ({
    slug: p.slug,
    nameEl: p.nameEl,
    nameEn: p.nameEn,
    descriptionEl: p.descriptionEl,
    descriptionEn: p.descriptionEn,
    price: p.price,
    stock: p.stock,
    isActive: true,
    categoryId: p.categoryId,
    brand: p.brand,
    images: [p.img],
  }))

  const created = await prisma.product.createMany({ data: allProducts, skipDuplicates: true })
  console.log(`Products added (new only): ${created.count}`)

  // ── 4b. Put some products on sale (compareAtPrice > price) ───
  // Two use the shop's real public deal prices; the rest are demo sales.
  const sales: Array<{ slug: string; price?: number; compareAtPrice: number }> = [
    { slug: 'taste-of-the-wild-puppy-beef-stew-390gr', price: 2.49, compareAtPrice: 3.20 },
    { slug: 'faunakram-antihairball-75gr', price: 3.00, compareAtPrice: 5.00 },
    { slug: 'orthopedic-dog-bed-large', compareAtPrice: 64.90 },
    { slug: 'donut-dog-bed-medium', compareAtPrice: 39.90 },
    { slug: 'cat-cave-bed-felt', compareAtPrice: 34.90 },
    { slug: 'heated-cat-bed', compareAtPrice: 44.90 },
    { slug: 'aquarium-internal-filter-200l', compareAtPrice: 32.00 },
    { slug: 'led-aquarium-light-60cm', compareAtPrice: 42.00 },
    { slug: 'tetra-goldfish-flakes-100g', compareAtPrice: 6.90 },
    { slug: 'schesir-kitten-care-150gr', compareAtPrice: 3.90 },
  ]
  for (const s of sales) {
    await prisma.product.updateMany({
      where: { slug: s.slug },
      data: { compareAtPrice: s.compareAtPrice, ...(s.price ? { price: s.price } : {}) },
    })
  }
  console.log(`Sales applied: ${sales.length}`)

  // ── 5. Delete the 8 empty duplicate leaf categories ──────────
  const emptyDupes = ['dog-food', 'dog-treats', 'dog-accessories', 'cat-food', 'cat-treats', 'cat-accessories', 'bird-food', 'rodent-food']
  for (const slug of emptyDupes) {
    const cat = await prisma.category.findUnique({ where: { slug }, select: { id: true, _count: { select: { products: true } } } })
    if (cat && cat._count.products === 0) {
      await prisma.category.delete({ where: { slug } })
      console.log(`Deleted empty category: ${slug}`)
    }
  }

  console.log('Catalog alignment complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
