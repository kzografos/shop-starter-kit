import { PrismaClient, AnimalAge } from '@prisma/client';

const prisma = new PrismaClient();

const IMGS = {
  dog: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500',
  cat: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500',
  bird: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=500',
  rodent: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500',
};

async function main() {
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log('Database already seeded. Skipping.');
    process.exit(0);
  }

  // Settings
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

  console.log('Seeding parent categories...');

  const [dogs, cats, birds, rodents] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'dogs' },
      update: {},
      create: { slug: 'dogs', nameEl: 'Σκύλοι', nameEn: 'Dogs', sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'cats' },
      update: {},
      create: { slug: 'cats', nameEl: 'Γάτες', nameEn: 'Cats', sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'birds' },
      update: {},
      create: { slug: 'birds', nameEl: 'Πουλιά', nameEn: 'Birds', sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'rodents' },
      update: {},
      create: { slug: 'rodents', nameEl: 'Τρωκτικά', nameEn: 'Rodents', sortOrder: 4 },
    }),
  ]);

  console.log('Seeding child categories...');

  const [
    dogFood, dogTreats, dogAccessories,
    catFood, catTreats, catAccessories,
    birdFood, birdAccessories,
    rodentFood, rodentAccessories,
  ] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'dog-food' },
      update: {},
      create: { slug: 'dog-food', nameEl: 'Τροφές Σκύλων', nameEn: 'Dog Food', parentId: dogs.id, sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'dog-treats' },
      update: {},
      create: { slug: 'dog-treats', nameEl: 'Λιχουδιές Σκύλων', nameEn: 'Dog Treats', parentId: dogs.id, sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'dog-accessories' },
      update: {},
      create: { slug: 'dog-accessories', nameEl: 'Αξεσουάρ Σκύλων', nameEn: 'Dog Accessories', parentId: dogs.id, sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'cat-food' },
      update: {},
      create: { slug: 'cat-food', nameEl: 'Τροφές Γάτων', nameEn: 'Cat Food', parentId: cats.id, sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'cat-treats' },
      update: {},
      create: { slug: 'cat-treats', nameEl: 'Λιχουδιές Γάτων', nameEn: 'Cat Treats', parentId: cats.id, sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'cat-accessories' },
      update: {},
      create: { slug: 'cat-accessories', nameEl: 'Αξεσουάρ Γάτων', nameEn: 'Cat Accessories', parentId: cats.id, sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'bird-food' },
      update: {},
      create: { slug: 'bird-food', nameEl: 'Τροφές Πουλιών', nameEn: 'Bird Food', parentId: birds.id, sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'bird-accessories' },
      update: {},
      create: { slug: 'bird-accessories', nameEl: 'Αξεσουάρ Πουλιών', nameEn: 'Bird Accessories', parentId: birds.id, sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'rodent-food' },
      update: {},
      create: { slug: 'rodent-food', nameEl: 'Τροφές Τρωκτικών', nameEn: 'Rodent Food', parentId: rodents.id, sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'rodent-accessories' },
      update: {},
      create: { slug: 'rodent-accessories', nameEl: 'Αξεσουάρ Τρωκτικών', nameEn: 'Rodent Accessories', parentId: rodents.id, sortOrder: 2 },
    }),
  ]);

  console.log('Seeding products...');

  await prisma.product.createMany({
    data: [
      // ── Dog Food (5) ──────────────────────────────────────────
      {
        slug: 'royal-canin-medium-adult-4kg',
        nameEl: 'Royal Canin Ενήλικες Μεσαίας Φυλής 4kg',
        nameEn: 'Royal Canin Medium Adult 4kg',
        descriptionEl: 'Πλήρης τροφή για ενήλικες σκύλους μεσαίας φυλής (11–25kg). Βελτιστοποιεί το πεπτικό σύστημα με υψηλής ποιότητας πρωτεΐνες.',
        descriptionEn: 'Complete food for adult medium breed dogs (11–25kg). Optimises digestive health with high-quality proteins.',
        price: 28.99, stock: 45, isActive: true,
        categoryId: dogFood.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ADULT, packageSize: '4kg', images: [IMGS.dog],
      },
      {
        slug: 'hills-science-diet-adult-small-bites-2kg',
        nameEl: 'Hills Science Diet Ενήλικες Μικρές Μπουκιές 2kg',
        nameEn: 'Hills Science Diet Adult Small Bites 2kg',
        descriptionEl: 'Επιστημονικά σχεδιασμένη τροφή για σκύλους μικρής φυλής. Εξαιρετική γεύση με κοτόπουλο και κριθάρι.',
        descriptionEn: 'Scientifically formulated food for small breed adult dogs. Exceptional taste with chicken and barley.',
        price: 32.50, stock: 38, isActive: true,
        categoryId: dogFood.id, brand: 'Hills',
        animalAge: AnimalAge.ADULT, packageSize: '2kg', images: [IMGS.dog],
      },
      {
        slug: 'purina-pro-plan-puppy-medium-3kg',
        nameEl: 'Purina Pro Plan Κουτάβι Μεσαίας Φυλής 3kg',
        nameEn: 'Purina Pro Plan Puppy Medium 3kg',
        descriptionEl: 'Πλήρης τροφή για κουτάβια μεσαίας φυλής. Εμπλουτισμένη με DHA για υγιή ανάπτυξη του εγκεφάλου.',
        descriptionEn: 'Complete food for medium breed puppies. Enriched with DHA for healthy brain development.',
        price: 24.99, stock: 52, isActive: true,
        categoryId: dogFood.id, brand: 'Purina',
        animalAge: AnimalAge.PUPPY, packageSize: '3kg', images: [IMGS.dog],
      },
      {
        slug: 'acana-prairie-poultry-adult-6kg',
        nameEl: 'Acana Prairie Poultry Ενήλικες 6kg',
        nameEn: 'Acana Prairie Poultry Adult 6kg',
        descriptionEl: 'Βιολογικά κατάλληλη τροφή με 60% κοτόπουλο, γαλοπούλα και αυγά ελεύθερης βοσκής.',
        descriptionEn: 'Biologically appropriate food with 60% free-run chicken, turkey, and eggs.',
        price: 55.00, stock: 28, isActive: true,
        categoryId: dogFood.id, brand: 'Acana',
        animalAge: AnimalAge.ADULT, packageSize: '6kg', images: [IMGS.dog],
      },
      {
        slug: 'orijen-original-dog-2kg',
        nameEl: 'Orijen Original Σκύλος 2kg',
        nameEn: 'Orijen Original Dog 2kg',
        descriptionEl: 'Τροφή με 85% κρέας από ποικιλία ζώων. Ολοκληρωμένη διατροφή χωρίς κόκκους.',
        descriptionEn: 'Food with 85% meat from a variety of whole animals. Complete grain-free nutrition.',
        price: 45.00, stock: 33, isActive: true,
        categoryId: dogFood.id, brand: 'Orijen',
        animalAge: AnimalAge.ALL, packageSize: '2kg', images: [IMGS.dog],
      },

      // ── Dog Treats (5) ────────────────────────────────────────
      {
        slug: 'pedigree-dentastix-daily-270g',
        nameEl: 'Pedigree Dentastix Καθημερινή Φροντίδα 270g',
        nameEn: 'Pedigree Dentastix Daily 270g',
        descriptionEl: 'Κλινικά αποδεδειγμένο ότι μειώνει τα οδοντικά επικαθίσματα έως 80%. Ιδανικό για καθημερινή οδοντική φροντίδα.',
        descriptionEn: 'Clinically proven to reduce tartar build-up by up to 80%. Ideal for daily dental care.',
        price: 6.99, stock: 85, isActive: true,
        categoryId: dogTreats.id, brand: 'Pedigree',
        animalAge: AnimalAge.ADULT, packageSize: '270g', images: [IMGS.dog],
      },
      {
        slug: 'royal-canin-mini-treats-50g',
        nameEl: 'Royal Canin Mini Λιχουδιές 50g',
        nameEn: 'Royal Canin Mini Treats 50g',
        descriptionEl: 'Μικρές λιχουδιές για σκύλους μικρής φυλής. Ιδανική επιβράβευση κατά την εκπαίδευση.',
        descriptionEn: 'Small treats for small breed dogs. Perfect reward during training.',
        price: 8.50, stock: 70, isActive: true,
        categoryId: dogTreats.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ADULT, packageSize: '50g', images: [IMGS.dog],
      },
      {
        slug: 'purina-bonio-original-350g',
        nameEl: 'Purina Bonio Κλασικά Μπισκότα 350g',
        nameEn: 'Purina Bonio Original 350g',
        descriptionEl: 'Κλασικά τετράγωνα μπισκότα με σιτάρι και λαχανικά. Χαμηλά σε λιπαρά, ιδανικά ως καθημερινή λιχουδιά.',
        descriptionEn: 'Classic square biscuits with wheat and vegetables. Low in fat, perfect as a daily treat.',
        price: 5.99, stock: 90, isActive: true,
        categoryId: dogTreats.id, brand: 'Purina',
        animalAge: AnimalAge.ADULT, packageSize: '350g', images: [IMGS.dog],
      },
      {
        slug: 'hills-soft-chewy-dog-treats-200g',
        nameEl: 'Hills Soft & Chewy Λιχουδιές Σκύλου 200g',
        nameEn: 'Hills Soft Chewy Dog Treats 200g',
        descriptionEl: 'Μαλακές λιχουδιές με φυσικές γεύσεις. Εμπλουτισμένες με βιταμίνες και μεταλλικά στοιχεία.',
        descriptionEn: 'Soft and chewy treats with natural flavours. Enriched with vitamins and minerals.',
        price: 9.99, stock: 60, isActive: true,
        categoryId: dogTreats.id, brand: 'Hills',
        animalAge: AnimalAge.ADULT, packageSize: '200g', images: [IMGS.dog],
      },
      {
        slug: 'acana-crunchy-treat-beef-100g',
        nameEl: 'Acana Crunchy Treat Μοσχάρι 100g',
        nameEn: 'Acana Crunchy Treat Beef 100g',
        descriptionEl: 'Τραγανές λιχουδιές με αποξηραμένο μοσχαρίσιο κρέας. 65% ολόκληρα υλικά κρέατος, χωρίς τεχνητά πρόσθετα.',
        descriptionEn: 'Crunchy treats with freeze-dried beef. 65% whole meat ingredients, no artificial additives.',
        price: 12.50, stock: 55, isActive: true,
        categoryId: dogTreats.id, brand: 'Acana',
        animalAge: AnimalAge.ALL, packageSize: '100g', images: [IMGS.dog],
      },

      // ── Dog Accessories (5) ───────────────────────────────────
      {
        slug: 'kong-classic-medium-red',
        nameEl: 'Kong Classic Κόκκινο Medium',
        nameEn: 'Kong Classic Medium Red',
        descriptionEl: 'Εμβληματικό παιχνίδι από φυσικό ελαστικό. Γεμίστε με λιχουδιές για ατελείωτη διασκέδαση.',
        descriptionEn: 'Iconic natural rubber toy. Stuff with treats for endless entertainment.',
        price: 14.99, stock: 50, isActive: true,
        categoryId: dogAccessories.id, brand: 'Pedigree',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.dog],
      },
      {
        slug: 'leather-dog-collar-black-medium',
        nameEl: 'Δερμάτινο Κολάρο Σκύλου Μαύρο Medium',
        nameEn: 'Leather Dog Collar Black Medium',
        descriptionEl: 'Ανθεκτικό δερμάτινο κολάρο με ρυθμιζόμενο μέγεθος. Άνετο για καθημερινή χρήση.',
        descriptionEn: 'Durable leather collar with adjustable sizing. Comfortable for everyday use.',
        price: 18.50, stock: 42, isActive: true,
        categoryId: dogAccessories.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.dog],
      },
      {
        slug: 'retractable-dog-leash-5m',
        nameEl: 'Εκτατό Λουρί Σκύλου 5m',
        nameEn: 'Retractable Dog Leash 5m',
        descriptionEl: 'Εκτατό λουρί 5 μέτρων με εργονομική λαβή. Ιδανικό για βόλτες στο πάρκο.',
        descriptionEn: 'Retractable 5-metre leash with ergonomic handle. Ideal for park walks.',
        price: 24.99, stock: 38, isActive: true,
        categoryId: dogAccessories.id, brand: 'Purina',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.dog],
      },
      {
        slug: 'stainless-steel-dog-bowl-1-5l',
        nameEl: 'Ανοξείδωτο Μπολ Σκύλου 1.5L',
        nameEn: 'Stainless Steel Dog Bowl 1.5L',
        descriptionEl: 'Ανθεκτικό ανοξείδωτο μπολ με αντιολισθητική βάση. Κατάλληλο για τρόφιμα και νερό.',
        descriptionEn: 'Durable stainless steel bowl with non-slip base. Suitable for food and water.',
        price: 9.99, stock: 65, isActive: true,
        categoryId: dogAccessories.id, brand: 'Hills',
        animalAge: AnimalAge.ALL, packageSize: '1.5L', images: [IMGS.dog],
      },
      {
        slug: 'dog-training-clicker',
        nameEl: 'Κλίκερ Εκπαίδευσης Σκύλου',
        nameEn: 'Dog Training Clicker',
        descriptionEl: 'Απλό εργαλείο θετικής ενίσχυσης για εκπαίδευση. Εύκολο κλικ με εργονομική λαβή.',
        descriptionEn: 'Simple positive reinforcement training tool. Easy click with ergonomic grip.',
        price: 5.99, stock: 80, isActive: true,
        categoryId: dogAccessories.id, brand: 'Acana',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.dog],
      },

      // ── Cat Food (5) ──────────────────────────────────────────
      {
        slug: 'royal-canin-indoor-adult-cat-2kg',
        nameEl: 'Royal Canin Indoor Ενήλικες Γάτες 2kg',
        nameEn: 'Royal Canin Indoor Adult Cat 2kg',
        descriptionEl: 'Ειδικά σχεδιασμένη τροφή για γάτες εσωτερικού χώρου. Μειώνει τις δυσάρεστες οσμές από τα κόπρανα.',
        descriptionEn: 'Specially designed food for indoor cats. Reduces unpleasant litter odours.',
        price: 25.99, stock: 48, isActive: true,
        categoryId: catFood.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ADULT, packageSize: '2kg', images: [IMGS.cat],
      },
      {
        slug: 'hills-science-diet-indoor-cat-1-6kg',
        nameEl: 'Hills Science Diet Indoor Γάτα 1.6kg',
        nameEn: 'Hills Science Diet Indoor Cat 1.6kg',
        descriptionEl: 'Υψηλής ποιότητας τροφή για γάτες εσωτερικού χώρου. Ελέγχει το βάρος και βελτιώνει την υγεία του τριχώματος.',
        descriptionEn: 'High-quality food for indoor cats. Controls weight and improves coat health.',
        price: 30.50, stock: 40, isActive: true,
        categoryId: catFood.id, brand: 'Hills',
        animalAge: AnimalAge.ADULT, packageSize: '1.6kg', images: [IMGS.cat],
      },
      {
        slug: 'whiskas-adult-chicken-1-9kg',
        nameEl: 'Whiskas Ενήλικες Κοτόπουλο 1.9kg',
        nameEn: 'Whiskas Adult Chicken 1.9kg',
        descriptionEl: 'Νόστιμη ξηρή τροφή για ενήλικες γάτες με γεύση κοτόπουλου. Πλούσια σε πρωτεΐνες και βιταμίνες.',
        descriptionEn: 'Tasty dry food for adult cats with chicken flavour. Rich in proteins and vitamins.',
        price: 12.99, stock: 72, isActive: true,
        categoryId: catFood.id, brand: 'Whiskas',
        animalAge: AnimalAge.ADULT, packageSize: '1.9kg', images: [IMGS.cat],
      },
      {
        slug: 'purina-one-adult-cat-chicken-1-5kg',
        nameEl: 'Purina One Ενήλικες Γάτα Κοτόπουλο 1.5kg',
        nameEn: 'Purina One Adult Cat Chicken 1.5kg',
        descriptionEl: 'Τροφή που ενισχύει ορατά την υγεία σε 30 ημέρες. Κοτόπουλο ως πρώτο συστατικό.',
        descriptionEn: 'Food that visibly boosts health in 30 days. Chicken as the number one ingredient.',
        price: 18.50, stock: 58, isActive: true,
        categoryId: catFood.id, brand: 'Purina',
        animalAge: AnimalAge.ADULT, packageSize: '1.5kg', images: [IMGS.cat],
      },
      {
        slug: 'orijen-cat-kitten-1-8kg',
        nameEl: 'Orijen Cat & Kitten 1.8kg',
        nameEn: 'Orijen Cat Kitten 1.8kg',
        descriptionEl: 'Τροφή χωρίς κόκκους με 90% ψάρι, κοτόπουλο και αυγά. Ιδανική για γάτες όλων των ηλικιών.',
        descriptionEn: 'Grain-free food with 90% fish, chicken, and eggs. Ideal for cats of all life stages.',
        price: 42.00, stock: 30, isActive: true,
        categoryId: catFood.id, brand: 'Orijen',
        animalAge: AnimalAge.ALL, packageSize: '1.8kg', images: [IMGS.cat],
      },

      // ── Cat Treats (5) ────────────────────────────────────────
      {
        slug: 'whiskas-temptations-chicken-60g',
        nameEl: 'Whiskas Temptations Κοτόπουλο 60g',
        nameEn: 'Whiskas Temptations Chicken 60g',
        descriptionEl: 'Ακαταμάχητες λιχουδιές με τραγανό εξωτερικό και μαλακό εσωτερικό. Γεύση κοτόπουλου.',
        descriptionEn: 'Irresistible treats with a crunchy outside and soft inside. Chicken flavour.',
        price: 4.50, stock: 95, isActive: true,
        categoryId: catTreats.id, brand: 'Whiskas',
        animalAge: AnimalAge.ADULT, packageSize: '60g', images: [IMGS.cat],
      },
      {
        slug: 'royal-canin-hairball-cat-treats-50g',
        nameEl: 'Royal Canin Hairball Λιχουδιές Γάτας 50g',
        nameEn: 'Royal Canin Hairball Cat Treats 50g',
        descriptionEl: 'Λιχουδιές που βοηθούν στην αποβολή τριχόμπαλων. Εμπλουτισμένες με φυτικές ίνες.',
        descriptionEn: 'Treats that help eliminate hairballs. Enriched with dietary fibre.',
        price: 8.99, stock: 68, isActive: true,
        categoryId: catTreats.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ADULT, packageSize: '50g', images: [IMGS.cat],
      },
      {
        slug: 'purina-dentalife-cat-54g',
        nameEl: 'Purina Dentalife Γάτα 54g',
        nameEn: 'Purina Dentalife Cat 54g',
        descriptionEl: 'Λιχουδιές για οδοντική φροντίδα γάτας. Κλινικά αποδεδειγμένο ότι μειώνει την ουρία έως 69%.',
        descriptionEn: 'Cat dental treats. Clinically proven to reduce tartar build-up by up to 69%.',
        price: 5.50, stock: 78, isActive: true,
        categoryId: catTreats.id, brand: 'Purina',
        animalAge: AnimalAge.ADULT, packageSize: '54g', images: [IMGS.cat],
      },
      {
        slug: 'hills-soft-chewy-cat-treats-200g',
        nameEl: 'Hills Soft & Chewy Λιχουδιές Γάτας 200g',
        nameEn: 'Hills Soft Chewy Cat Treats 200g',
        descriptionEl: 'Μαλακές λιχουδιές με φυσικές γεύσεις κοτόπουλου. Χαμηλές σε θερμίδες.',
        descriptionEn: 'Soft treats with natural chicken flavour. Low in calories.',
        price: 9.50, stock: 62, isActive: true,
        categoryId: catTreats.id, brand: 'Hills',
        animalAge: AnimalAge.ADULT, packageSize: '200g', images: [IMGS.cat],
      },
      {
        slug: 'acana-premium-cat-treats-salmon-35g',
        nameEl: 'Acana Premium Λιχουδιές Γάτας Σολομός 35g',
        nameEn: 'Acana Premium Cat Treats Salmon 35g',
        descriptionEl: 'Freeze-dried λιχουδιές από φρέσκο σολομό. 100% φυσικά υλικά χωρίς συντηρητικά.',
        descriptionEn: 'Freeze-dried treats made from fresh salmon. 100% natural ingredients, no preservatives.',
        price: 11.99, stock: 50, isActive: true,
        categoryId: catTreats.id, brand: 'Acana',
        animalAge: AnimalAge.ALL, packageSize: '35g', images: [IMGS.cat],
      },

      // ── Cat Accessories (5) ───────────────────────────────────
      {
        slug: 'sisal-cat-scratcher-post-60cm',
        nameEl: 'Κόρος Ξυσίματος Γάτας Sisal 60cm',
        nameEn: 'Sisal Cat Scratcher Post 60cm',
        descriptionEl: 'Ψηλός κόρος από φυσικό sisal. Σταθερή βάση αποτρέπει την ανατροπή.',
        descriptionEn: 'Tall natural sisal scratching post. Stable base prevents tipping.',
        price: 22.50, stock: 35, isActive: true,
        categoryId: catAccessories.id, brand: 'Royal Canin',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.cat],
      },
      {
        slug: 'interactive-feather-wand-cat-toy',
        nameEl: 'Διαδραστικό Παιχνίδι Φτερό για Γάτες',
        nameEn: 'Interactive Feather Wand Cat Toy',
        descriptionEl: 'Ραβδί με φτερά για διαδραστικό παιχνίδι. Διεγείρει τα φυσικά ένστικτα κυνηγιού.',
        descriptionEn: 'Feather wand for interactive play. Stimulates natural hunting instincts.',
        price: 8.99, stock: 58, isActive: true,
        categoryId: catAccessories.id, brand: 'Whiskas',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.cat],
      },
      {
        slug: 'covered-cat-litter-box-with-filter',
        nameEl: 'Κλειστή Τουαλέτα Γάτας με Φίλτρο',
        nameEn: 'Covered Cat Litter Box with Filter',
        descriptionEl: 'Κλειστή τουαλέτα με φίλτρο ενεργού άνθρακα για έλεγχο οσμών. Εύκολη πρόσβαση με πόρτα.',
        descriptionEn: 'Covered litter box with activated carbon filter for odour control. Easy access via door.',
        price: 34.99, stock: 28, isActive: true,
        categoryId: catAccessories.id, brand: 'Purina',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.cat],
      },
      {
        slug: 'stainless-steel-cat-bowl-set',
        nameEl: 'Σετ Ανοξείδωτα Μπολ Γάτας',
        nameEn: 'Stainless Steel Cat Bowl Set',
        descriptionEl: 'Σετ δύο ανοξείδωτων μπολ για φαγητό και νερό. Αντιολισθητική βάση σιλικόνης.',
        descriptionEn: 'Set of two stainless steel bowls for food and water. Non-slip silicone base.',
        price: 11.50, stock: 55, isActive: true,
        categoryId: catAccessories.id, brand: 'Hills',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.cat],
      },
      {
        slug: 'foldable-pet-carrier-medium',
        nameEl: 'Πτυσσόμενη Τσάντα Μεταφοράς Κατοικίδιου Medium',
        nameEn: 'Foldable Pet Carrier Medium',
        descriptionEl: 'Ελαφρύ και πτυσσόμενο τσαντάκι μεταφοράς. Εγκεκριμένο για αεροπορικές μεταφορές.',
        descriptionEn: 'Lightweight foldable carrier. Airline approved for cabin travel.',
        price: 38.00, stock: 22, isActive: true,
        categoryId: catAccessories.id, brand: 'Acana',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.cat],
      },

      // ── Bird Food (5) ─────────────────────────────────────────
      {
        slug: 'versele-laga-prestige-budgies-1kg',
        nameEl: 'Versele-Laga Prestige Παπαγαλάκια 1kg',
        nameEn: 'Versele-Laga Prestige Budgies 1kg',
        descriptionEl: 'Πλήρες μείγμα σπόρων για παπαγαλάκια. Περιέχει κεχρί, βρώμη και σπόρους ηλιάνθου.',
        descriptionEn: 'Complete seed mix for budgerigars. Contains millet, oats, and sunflower seeds.',
        price: 7.50, stock: 65, isActive: true,
        categoryId: birdFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '1kg', images: [IMGS.bird],
      },
      {
        slug: 'versele-laga-prestige-canaries-1kg',
        nameEl: 'Versele-Laga Prestige Καναρίνια 1kg',
        nameEn: 'Versele-Laga Prestige Canaries 1kg',
        descriptionEl: 'Εξαιρετικό μείγμα σπόρων για καναρίνια. Εμπλουτισμένο με βιταμίνες και μέταλλα.',
        descriptionEn: 'Excellent seed mix for canaries. Enriched with vitamins and minerals.',
        price: 8.50, stock: 58, isActive: true,
        categoryId: birdFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '1kg', images: [IMGS.bird],
      },
      {
        slug: 'versele-laga-parrot-complete-750g',
        nameEl: 'Versele-Laga Parrot Complete 750g',
        nameEn: 'Versele-Laga Parrot Complete 750g',
        descriptionEl: 'Ολοκληρωμένη τροφή για μεσαίου μεγέθους παπαγάλους. Πελλέτες με φρούτα και λαχανικά.',
        descriptionEn: 'Complete food for medium-sized parrots. Pellets with fruits and vegetables.',
        price: 12.99, stock: 45, isActive: true,
        categoryId: birdFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ADULT, packageSize: '750g', images: [IMGS.bird],
      },
      {
        slug: 'versele-laga-african-grey-750g',
        nameEl: 'Versele-Laga African Grey 750g',
        nameEn: 'Versele-Laga African Grey 750g',
        descriptionEl: 'Ειδικά σχεδιασμένη τροφή για Γκρι Παπαγάλους της Αφρικής. Εμπλουτισμένη με ασβέστιο και βιταμίνη D3.',
        descriptionEn: 'Specially formulated food for African Grey parrots. Enriched with calcium and vitamin D3.',
        price: 14.50, stock: 38, isActive: true,
        categoryId: birdFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ADULT, packageSize: '750g', images: [IMGS.bird],
      },
      {
        slug: 'orlux-eggfood-dry-canaries-250g',
        nameEl: 'Orlux Αυγοτροφή Ξηρή Καναρίνια 250g',
        nameEn: 'Orlux Eggfood Dry Canaries 250g',
        descriptionEl: 'Πλούσια σε πρωτεΐνες ξηρή αυγοτροφή για καναρίνια. Ιδανική κατά την αναπαραγωγική περίοδο.',
        descriptionEn: 'Protein-rich dry eggfood for canaries. Ideal during the breeding season.',
        price: 9.99, stock: 50, isActive: true,
        categoryId: birdFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '250g', images: [IMGS.bird],
      },

      // ── Bird Accessories (5) ──────────────────────────────────
      {
        slug: 'natural-wood-perch-set-birds',
        nameEl: 'Σετ Φυσικών Κούρνιων Ξύλου',
        nameEn: 'Natural Wood Perch Set Birds',
        descriptionEl: 'Σετ τριών φυσικών ξύλινων κούρνιων διαφορετικών διαμέτρων. Βελτιώνει την υγεία των ποδιών.',
        descriptionEn: 'Set of three natural wooden perches in different diameters. Improves foot health.',
        price: 12.50, stock: 45, isActive: true,
        categoryId: birdAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.bird],
      },
      {
        slug: 'cuttlebone-mineral-block-2-pack',
        nameEl: 'Σουπιά Μεταλλική Μπλοκ 2-pack',
        nameEn: 'Cuttlebone Mineral Block 2-pack',
        descriptionEl: 'Φυσική σουπιά για πουλιά. Παρέχει ασβέστιο και βοηθά στο φθόρισμα του ράμφους.',
        descriptionEn: 'Natural cuttlebone for birds. Provides calcium and helps beak wear.',
        price: 4.99, stock: 90, isActive: true,
        categoryId: birdAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '2-pack', images: [IMGS.bird],
      },
      {
        slug: 'hanging-bird-bath',
        nameEl: 'Κρεμαστό Λουτρό Πουλιών',
        nameEn: 'Hanging Bird Bath',
        descriptionEl: 'Κρεμαστό λουτρό για κλουβί. Εύκολο γέμισμα και καθαρισμός. Κατάλληλο για μικρά πουλιά.',
        descriptionEn: 'Hanging bath for cage. Easy to fill and clean. Suitable for small birds.',
        price: 11.99, stock: 40, isActive: true,
        categoryId: birdAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.bird],
      },
      {
        slug: 'rainbow-swing-toy-birds',
        nameEl: 'Κούνια Rainbow για Πουλιά',
        nameEn: 'Rainbow Swing Toy Birds',
        descriptionEl: 'Χρωματιστή κούνια από φυσικό ξύλο και ακρυλικό. Ιδανική για παπαγαλάκια και καναρίνια.',
        descriptionEn: 'Colourful swing made from natural wood and acrylic. Ideal for budgies and canaries.',
        price: 8.50, stock: 55, isActive: true,
        categoryId: birdAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.bird],
      },
      {
        slug: 'gravity-water-dispenser-bird-200ml',
        nameEl: 'Αυτόματος Διανομέας Νερού Πουλιών 200ml',
        nameEn: 'Gravity Water Dispenser Bird 200ml',
        descriptionEl: 'Αυτόματος διανομέας νερού για κλουβί πουλιών. Διατηρεί το νερό καθαρό και φρέσκο.',
        descriptionEn: 'Automatic water dispenser for bird cage. Keeps water clean and fresh.',
        price: 6.99, stock: 62, isActive: true,
        categoryId: birdAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '200ml', images: [IMGS.bird],
      },

      // ── Rodent Food (5) ───────────────────────────────────────
      {
        slug: 'versele-laga-hamster-nature-750g',
        nameEl: 'Versele-Laga Hamster Nature 750g',
        nameEn: 'Versele-Laga Hamster Nature 750g',
        descriptionEl: 'Φυσική τροφή για χάμστερ με σπόρους, κόκκους και αποξηραμένα λαχανικά.',
        descriptionEn: 'Natural food for hamsters with seeds, grains, and dried vegetables.',
        price: 6.99, stock: 68, isActive: true,
        categoryId: rodentFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '750g', images: [IMGS.rodent],
      },
      {
        slug: 'versele-laga-gerbil-nature-400g',
        nameEl: 'Versele-Laga Gerbil Nature 400g',
        nameEn: 'Versele-Laga Gerbil Nature 400g',
        descriptionEl: 'Ολοκληρωμένη τροφή για γέρμπιλ. Μείγμα σπόρων και κόκκων με φυσικά λαχανικά.',
        descriptionEn: 'Complete food for gerbils. Seed and grain mix with natural vegetables.',
        price: 5.50, stock: 55, isActive: true,
        categoryId: rodentFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '400g', images: [IMGS.rodent],
      },
      {
        slug: 'versele-laga-complete-rabbit-1kg',
        nameEl: 'Versele-Laga Complete Κουνέλι 1kg',
        nameEn: 'Versele-Laga Complete Rabbit 1kg',
        descriptionEl: 'Ολοκληρωμένη τροφή για κουνέλια με χόρτο, λαχανικά και φρούτα. Πλούσια σε φυτικές ίνες.',
        descriptionEn: 'Complete food for rabbits with hay, vegetables, and fruit. Rich in dietary fibre.',
        price: 8.99, stock: 50, isActive: true,
        categoryId: rodentFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ADULT, packageSize: '1kg', images: [IMGS.rodent],
      },
      {
        slug: 'purina-friskies-guinea-pig-900g',
        nameEl: 'Purina Friskies Ινδικό Χοιρίδιο 900g',
        nameEn: 'Purina Friskies Guinea Pig 900g',
        descriptionEl: 'Πλήρης τροφή για ινδικά χοιρίδια εμπλουτισμένη με βιταμίνη C. Μείγμα σπόρων και κόκκων.',
        descriptionEn: 'Complete food for guinea pigs enriched with vitamin C. Seed and grain mix.',
        price: 7.50, stock: 60, isActive: true,
        categoryId: rodentFood.id, brand: 'Purina',
        animalAge: AnimalAge.ADULT, packageSize: '900g', images: [IMGS.rodent],
      },
      {
        slug: 'vitakraft-menu-vital-rat-1kg',
        nameEl: 'Vitakraft Menu Vital Αρουραίος 1kg',
        nameEn: 'Vitakraft Menu Vital Rat 1kg',
        descriptionEl: 'Ισορροπημένη τροφή για αρουραίους με κόκκους, σπόρους και αποξηραμένα λαχανικά.',
        descriptionEn: 'Balanced food for rats with grains, seeds, and dried vegetables.',
        price: 9.99, stock: 48, isActive: true,
        categoryId: rodentFood.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ADULT, packageSize: '1kg', images: [IMGS.rodent],
      },

      // ── Rodent Accessories (5) ────────────────────────────────
      {
        slug: 'silent-spinner-hamster-wheel',
        nameEl: 'Αθόρυβος Τροχός Γυμναστικής Χάμστερ',
        nameEn: 'Silent Spinner Hamster Wheel',
        descriptionEl: 'Αθόρυβος τροχός γυμναστικής για χάμστερ. Ασφαλής σχεδίαση χωρίς τρύπες.',
        descriptionEn: 'Silent exercise wheel for hamsters. Safe design without holes.',
        price: 13.50, stock: 42, isActive: true,
        categoryId: rodentAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.rodent],
      },
      {
        slug: 'wooden-hideout-small-animal',
        nameEl: 'Ξύλινο Καταφύγιο Μικρών Ζώων',
        nameEn: 'Wooden Hideout Small Animal',
        descriptionEl: 'Φυσικό ξύλινο καταφύγιο για μικρά ζώα. Ιδανικό για χάμστερ, αρουραίους και γέρμπιλ.',
        descriptionEn: 'Natural wooden hideout for small animals. Ideal for hamsters, rats, and gerbils.',
        price: 11.99, stock: 48, isActive: true,
        categoryId: rodentAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: null, images: [IMGS.rodent],
      },
      {
        slug: 'apple-wood-chew-sticks-100g',
        nameEl: 'Μαστιχόξυλα Μηλιάς 100g',
        nameEn: 'Apple Wood Chew Sticks 100g',
        descriptionEl: 'Φυσικά ξυλάκια από μηλιά για μάσηση. Βοηθούν στο φθόρισμα των δοντιών.',
        descriptionEn: 'Natural apple wood sticks for chewing. Help wear down teeth naturally.',
        price: 4.50, stock: 85, isActive: true,
        categoryId: rodentAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '100g', images: [IMGS.rodent],
      },
      {
        slug: 'small-animal-water-bottle-250ml',
        nameEl: 'Μπουκάλι Νερού Μικρών Ζώων 250ml',
        nameEn: 'Small Animal Water Bottle 250ml',
        descriptionEl: 'Μπουκάλι νερού με ακροφύσιο μπίλιας για κλουβί. Αποτρέπει τη διαρροή και τη μόλυνση.',
        descriptionEn: 'Ball-sipper water bottle for cage. Prevents leaking and contamination.',
        price: 7.99, stock: 70, isActive: true,
        categoryId: rodentAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '250ml', images: [IMGS.rodent],
      },
      {
        slug: 'premium-bedding-nesting-20l',
        nameEl: 'Premium Στρώμα & Υλικό Φωλιάσματος 20L',
        nameEn: 'Premium Bedding Nesting Material 20L',
        descriptionEl: 'Μαλακό και απορροφητικό υλικό στρώματος από φυσικές ίνες. Ιδανικό για όλα τα μικρά τρωκτικά.',
        descriptionEn: 'Soft and absorbent bedding from natural fibres. Ideal for all small rodents.',
        price: 9.50, stock: 55, isActive: true,
        categoryId: rodentAccessories.id, brand: 'Versele-Laga',
        animalAge: AnimalAge.ALL, packageSize: '20L', images: [IMGS.rodent],
      },
    ],
  });

  console.log('Seed complete! 14 categories and 50 products created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
