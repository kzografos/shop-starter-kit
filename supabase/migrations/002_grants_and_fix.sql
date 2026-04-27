-- Grant table access to anon + authenticated roles
-- (RLS policies alone are not enough — need base table privileges too)
grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.settings to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.loyalty_transactions to authenticated;

-- Fix missing profile for users who signed up before migration ran
insert into public.profiles (id, email, role)
select id, email, 'customer'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- Set your account as admin (run after above)
-- Replace with your email if different
update public.profiles
set role = 'admin'
where email = 'konszografos@gmail.com';
