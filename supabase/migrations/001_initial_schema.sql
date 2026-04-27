-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SETTINGS (config-driven: loyalty rates, shipping costs)
-- ============================================================
create table public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into public.settings (key, value) values
  ('loyalty_earn_rate', '100'),       -- points earned per €1 spent
  ('loyalty_redeem_rate', '100'),     -- points needed per €1 discount
  ('loyalty_min_redeem', '500'),      -- minimum points required to redeem
  ('shipping_cost', '5.00'),
  ('free_shipping_threshold', '50.00');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  phone text,
  loyalty_points integer not null default 0,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CATEGORIES (self-referencing, 2 levels: animal → type)
-- ============================================================
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  name_el text not null,
  name_en text not null,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Seed top-level animal categories
insert into public.categories (slug, name_el, name_en, sort_order) values
  ('dogs', 'Σκύλος', 'Dog', 1),
  ('cats', 'Γάτα', 'Cat', 2),
  ('birds', 'Πουλιά', 'Bird', 3),
  ('rodents', 'Τρωκτικά', 'Rodent', 4);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  name_el text not null,
  name_en text not null,
  description_el text,
  description_en text,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  category_id uuid references public.categories(id) on delete set null,
  brand text,
  animal_age text not null default 'all' check (animal_age in ('puppy', 'kitten', 'adult', 'senior', 'all')),
  package_size text,
  images text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index products_category_idx on public.products(category_id);
create index products_brand_idx on public.products(brand);
create index products_active_idx on public.products(is_active);
create index products_slug_idx on public.products(slug);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ORDERS
-- ============================================================
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled')),
  fulfillment_type text not null
    check (fulfillment_type in ('shipping', 'pickup')),
  payment_method text not null
    check (payment_method in ('stripe', 'cash_on_pickup', 'card_on_pickup')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  subtotal numeric(10,2) not null,
  shipping_cost numeric(10,2) not null default 0,
  loyalty_discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  shipping_address jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index orders_user_idx on public.orders(user_id);
create index orders_status_idx on public.orders(status);

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  created_at timestamptz default now()
);

create index order_items_order_idx on public.order_items(order_id);

-- Decrement stock on order item insert (prevents oversell)
create or replace function public.decrement_product_stock()
returns trigger as $$
begin
  update public.products
  set stock = stock - new.quantity
  where id = new.product_id
    and stock >= new.quantity;

  if not found then
    raise exception 'Insufficient stock for product %', new.product_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_order_item_inserted
  after insert on public.order_items
  for each row execute procedure public.decrement_product_stock();

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
create table public.loyalty_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  points_delta integer not null,
  type text not null check (type in ('earn', 'redeem')),
  created_at timestamptz default now()
);

create index loyalty_user_idx on public.loyalty_transactions(user_id);

-- Helper RPC: adjust loyalty points safely (floor at 0)
create or replace function public.adjust_loyalty_points(p_user_id uuid, p_delta integer)
returns void as $$
begin
  update public.profiles
  set loyalty_points = greatest(0, loyalty_points + p_delta)
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- GRANTS (base table privileges — required alongside RLS policies)
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.settings to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.loyalty_transactions to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.settings enable row level security;

-- Helper: check if caller is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Profiles
create policy "Users view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins manage all profiles"
  on public.profiles for all using (public.is_admin());

-- Products: public read (active only), admin write
create policy "Public read active products"
  on public.products for select using (is_active = true);

create policy "Admins manage products"
  on public.products for all using (public.is_admin());

-- Categories: public read, admin write
create policy "Public read categories"
  on public.categories for select using (true);

create policy "Admins manage categories"
  on public.categories for all using (public.is_admin());

-- Orders
create policy "Users view own orders"
  on public.orders for select using (auth.uid() = user_id);

create policy "Users create own orders"
  on public.orders for insert with check (auth.uid() = user_id);

create policy "Admins manage all orders"
  on public.orders for all using (public.is_admin());

-- Order items
create policy "Users view own order items"
  on public.order_items for select using (
    exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
  );

create policy "Users create order items"
  on public.order_items for insert with check (
    exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
  );

create policy "Admins manage order items"
  on public.order_items for all using (public.is_admin());

-- Loyalty
create policy "Users view own loyalty"
  on public.loyalty_transactions for select using (auth.uid() = user_id);

create policy "Admins manage loyalty"
  on public.loyalty_transactions for all using (public.is_admin());

-- Settings: public read, admin write
create policy "Public read settings"
  on public.settings for select using (true);

create policy "Admins manage settings"
  on public.settings for all using (public.is_admin());
