-- ============================================================
-- SEED: Sub-categories
-- ============================================================
insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'dogs-food', 'Τροφές Σκύλου', 'Dog Food', id, 1 from public.categories where slug = 'dogs';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'dogs-treats', 'Λιχουδιές Σκύλου', 'Dog Treats', id, 2 from public.categories where slug = 'dogs';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'dogs-accessories', 'Αξεσουάρ Σκύλου', 'Dog Accessories', id, 3 from public.categories where slug = 'dogs';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'cats-food', 'Τροφές Γάτας', 'Cat Food', id, 1 from public.categories where slug = 'cats';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'cats-treats', 'Λιχουδιές Γάτας', 'Cat Treats', id, 2 from public.categories where slug = 'cats';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'cats-accessories', 'Αξεσουάρ Γάτας', 'Cat Accessories', id, 3 from public.categories where slug = 'cats';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'birds-food', 'Τροφές Πουλιών', 'Bird Food', id, 1 from public.categories where slug = 'birds';

insert into public.categories (slug, name_el, name_en, parent_id, sort_order)
select 'rodents-food', 'Τροφές Τρωκτικών', 'Rodent Food', id, 1 from public.categories where slug = 'rodents';

-- ============================================================
-- SEED: Products — Dogs
-- ============================================================
insert into public.products (slug, name_el, name_en, description_el, description_en, price, stock, brand, animal_age, package_size, category_id, images)
values
(
  'royal-canin-medium-adult-15kg',
  'Royal Canin Medium Adult 15kg',
  'Royal Canin Medium Adult 15kg',
  'Ξηρά τροφή για ενήλικες σκύλους μεσαίων φυλών. Βοηθά στη διατήρηση υγιούς βάρους και δυνατών μυών.',
  'Dry food for adult medium breed dogs. Supports healthy weight and strong muscles.',
  52.99, 45, 'Royal Canin', 'adult', '15kg',
  (select id from public.categories where slug = 'dogs-food'),
  ARRAY['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500']
),
(
  'royal-canin-medium-puppy-4kg',
  'Royal Canin Medium Puppy 4kg',
  'Royal Canin Medium Puppy 4kg',
  'Ξηρά τροφή ειδικά σχεδιασμένη για κουτάβια μεσαίων φυλών έως 12 μηνών.',
  'Dry food specially designed for medium breed puppies up to 12 months.',
  22.50, 30, 'Royal Canin', 'puppy', '4kg',
  (select id from public.categories where slug = 'dogs-food'),
  ARRAY['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500']
),
(
  'purina-proplan-adult-chicken-3kg',
  'Purina Pro Plan Adult Chicken 3kg',
  'Purina Pro Plan Adult Chicken 3kg',
  'Ξηρά τροφή με κοτόπουλο για ενήλικες σκύλους. Υψηλή περιεκτικότητα σε πρωτεΐνη.',
  'Dry food with chicken for adult dogs. High protein content for strong muscles.',
  18.90, 60, 'Purina Pro Plan', 'adult', '3kg',
  (select id from public.categories where slug = 'dogs-food'),
  ARRAY['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500']
),
(
  'pedigree-dentastix-large-28pack',
  'Pedigree Dentastix Large 28τμχ',
  'Pedigree Dentastix Large 28pcs',
  'Λιχουδιές για καθαρισμό δοντιών μεγάλων σκύλων. Μειώνει την πλάκα και τον τρυγία κατά 80%.',
  'Dental treats for large dogs. Reduces plaque and tartar by up to 80%.',
  12.50, 80, 'Pedigree', 'adult', '28τμχ',
  (select id from public.categories where slug = 'dogs-treats'),
  ARRAY['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500']
),
(
  'trixie-adjustable-collar-red-m',
  'Trixie Κολλάρο Ρυθμιζόμενο Κόκκινο M',
  'Trixie Adjustable Collar Red M',
  'Ανθεκτικό νάιλον κολλάρο με ρυθμιζόμενο κούμπωμα. Κατάλληλο για λαιμό 30–45cm.',
  'Durable nylon collar with adjustable buckle. Suitable for neck 30–45cm.',
  8.99, 50, 'Trixie', 'all', 'M',
  (select id from public.categories where slug = 'dogs-accessories'),
  ARRAY['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500']
),
(
  'kong-classic-medium',
  'Kong Classic Medium',
  'Kong Classic Medium',
  'Το κλασικό παιχνίδι σκύλου από ανθεκτικό καουτσούκ. Ιδανικό για γέμισμα με λιχουδιές.',
  'The classic dog toy made from durable rubber. Ideal for stuffing with treats.',
  14.99, 35, 'Kong', 'all', 'Medium',
  (select id from public.categories where slug = 'dogs-accessories'),
  ARRAY['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500']
),

-- ============================================================
-- SEED: Products — Cats
-- ============================================================
(
  'royal-canin-sterilised-cat-4kg',
  'Royal Canin Sterilised Cat 4kg',
  'Royal Canin Sterilised Cat 4kg',
  'Ξηρά τροφή για στειρωμένες γάτες. Βοηθά στη διατήρηση ιδανικού βάρους.',
  'Dry food for sterilised cats. Helps maintain ideal body weight.',
  24.90, 40, 'Royal Canin', 'adult', '4kg',
  (select id from public.categories where slug = 'cats-food'),
  ARRAY['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500']
),
(
  'whiskas-kitten-chicken-2kg',
  'Whiskas Kitten Κοτόπουλο 2kg',
  'Whiskas Kitten Chicken 2kg',
  'Ξηρά τροφή για γατάκια έως 12 μηνών. Πλούσια σε πρωτεΐνες για υγιή ανάπτυξη.',
  'Dry food for kittens up to 12 months. Rich in protein for healthy development.',
  9.50, 55, 'Whiskas', 'kitten', '2kg',
  (select id from public.categories where slug = 'cats-food'),
  ARRAY['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500']
),
(
  'dreamies-cat-treats-salmon-60g',
  'Dreamies Λιχουδιές Σολομός 60g',
  'Dreamies Cat Treats Salmon 60g',
  'Αγαπημένες λιχουδιές για γάτες με γεύση σολομού. Τραγανές από έξω, μαλακές από μέσα.',
  'Favourite cat treats with salmon flavour. Crunchy outside, soft inside.',
  2.99, 120, 'Dreamies', 'adult', '60g',
  (select id from public.categories where slug = 'cats-treats'),
  ARRAY['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500']
),
(
  'trixie-scratching-post-sisal-50cm',
  'Trixie Στύλος Ξύσματος Sisal 50cm',
  'Trixie Scratching Post Sisal 50cm',
  'Στύλος ξύσματος από φυσικό sisal για γάτες. Βοηθά στη διατήρηση υγιών νυχιών.',
  'Natural sisal scratching post for cats. Helps maintain healthy claws.',
  19.90, 25, 'Trixie', 'all', '50cm',
  (select id from public.categories where slug = 'cats-accessories'),
  ARRAY['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500']
),

-- ============================================================
-- SEED: Products — Birds & Rodents
-- ============================================================
(
  'versele-laga-canary-1kg',
  'Versele-Laga Τροφή Καναρινιών 1kg',
  'Versele-Laga Canary Food 1kg',
  'Πλήρης τροφή για καναρίνια. Μείγμα σπόρων υψηλής ποιότητας.',
  'Complete food for canaries. High quality seed mix.',
  5.50, 70, 'Versele-Laga', 'all', '1kg',
  (select id from public.categories where slug = 'birds-food'),
  ARRAY['https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=500']
),
(
  'vitakraft-hamster-mix-400g',
  'Vitakraft Μείγμα Χάμστερ 400g',
  'Vitakraft Hamster Mix 400g',
  'Πλήρης τροφή για χάμστερ. Περιέχει σπόρους, δημητριακά και αποξηραμένα λαχανικά.',
  'Complete hamster food. Contains seeds, grains and dried vegetables.',
  4.20, 60, 'Vitakraft', 'all', '400g',
  (select id from public.categories where slug = 'rodents-food'),
  ARRAY['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500']
);
