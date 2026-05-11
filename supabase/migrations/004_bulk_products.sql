INSERT INTO public.products (
  slug, name_el, name_en,
  description_el, description_en,
  price, stock, brand,
  animal_age, package_size,
  category_id, images, is_active
)
SELECT
  -- Unique slug: brand-type-seq
  lower(replace(brand_val, ' ', '-')) || '-' || type_val || '-' || seq,
  -- Greek name
  brand_val || ' ' || name_val || ' ' || size_val,
  -- English name  
  brand_val || ' ' || name_en_val || ' ' || size_val,
  -- Description
  desc_el_val,
  desc_en_val,
  -- Price: random between 3.99 and 89.99
  round((random() * 86 + 3.99)::numeric, 2),
  -- Stock: random 0–120, some out of stock
  floor(random() * 120)::int,
  brand_val,
  age_val,
  size_val,
  cat_id,
  ARRAY[img_val],
  true

FROM (
  SELECT
    seq,
    -- 🔧 ADD YOUR BRANDS HERE
    (ARRAY[
      'Royal Canin', 'Purina Pro Plan', 'Pedigree',
      'Whiskas', 'Dreamies', 'Trixie', 'Kong',
      'Versele-Laga', 'Vitakraft', 'Hill''s Science Diet',
      'Eukanuba', 'Orijen', 'Acana', 'Blue Buffalo', 'Advance'
    ])[((seq - 1) % 15) + 1] AS brand_val,

    -- 🔧 ADD YOUR PRODUCT TYPES (Greek)
    (ARRAY[
      'Ξηρά Τροφή', 'Υγρή Τροφή', 'Λιχουδιές',
      'Κονσέρβα', 'Σνακ', 'Συμπλήρωμα'
    ])[((seq - 1) % 6) + 1] AS name_val,

    -- 🔧 ENGLISH TYPES
    (ARRAY[
      'Dry Food', 'Wet Food', 'Treats',
      'Canned Food', 'Snacks', 'Supplement'
    ])[((seq - 1) % 6) + 1] AS name_en_val,

    -- slug type fragment
    (ARRAY[
      'dry', 'wet', 'treats',
      'canned', 'snacks', 'supplement'
    ])[((seq - 1) % 6) + 1] AS type_val,

    -- 🔧 SIZES
    (ARRAY[
      '400g', '1kg', '2kg', '4kg',
      '6kg', '10kg', '15kg', '500g'
    ])[((seq - 1) % 8) + 1] AS size_val,

    -- 🔧 ANIMAL AGES
    (ARRAY[
      'adult', 'puppy', 'kitten',
      'senior', 'all'
    ])[((seq - 1) % 5) + 1] AS age_val,

    -- 🔧 CATEGORIES — cycle through all 8
    (SELECT id FROM public.categories WHERE slug =
      (ARRAY[
        'dogs-food', 'dogs-treats', 'dogs-accessories',
        'cats-food', 'cats-treats', 'cats-accessories',
        'birds-food', 'rodents-food'
      ])[((seq - 1) % 8) + 1]
    ) AS cat_id,

    -- 🔧 IMAGES — use category-appropriate ones
    (ARRAY[
      'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500',
      'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500',
      'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=500',
      'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500',
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500',
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500'
    ])[((seq - 1) % 6) + 1] AS img_val,

    -- Descriptions (cycle through a few)
    (ARRAY[
      'Πλήρης και ισορροπημένη τροφή υψηλής ποιότητας.',
      'Ειδικά σχεδιασμένη για τις ανάγκες του κατοικιδίου σας.',
      'Με φυσικά συστατικά για άριστη υγεία και ευεξία.'
    ])[((seq - 1) % 3) + 1] AS desc_el_val,

    (ARRAY[
      'Complete and balanced high quality food.',
      'Specially designed for your pet''s needs.',
      'With natural ingredients for optimal health and wellbeing.'
    ])[((seq - 1) % 3) + 1] AS desc_en_val

  FROM generate_series(13, 412) AS seq
) t;