-- Rename all enum values to lowercase (matching Supabase seed SQL)

-- user_role
ALTER TYPE "user_role" RENAME VALUE 'CUSTOMER' TO 'customer';
ALTER TYPE "user_role" RENAME VALUE 'ADMIN' TO 'admin';

-- animal_age
ALTER TYPE "animal_age" RENAME VALUE 'PUPPY' TO 'puppy';
ALTER TYPE "animal_age" RENAME VALUE 'KITTEN' TO 'kitten';
ALTER TYPE "animal_age" RENAME VALUE 'ADULT' TO 'adult';
ALTER TYPE "animal_age" RENAME VALUE 'SENIOR' TO 'senior';
ALTER TYPE "animal_age" RENAME VALUE 'ALL' TO 'all';

-- order_status
ALTER TYPE "order_status" RENAME VALUE 'PENDING' TO 'pending';
ALTER TYPE "order_status" RENAME VALUE 'CONFIRMED' TO 'confirmed';
ALTER TYPE "order_status" RENAME VALUE 'PROCESSING' TO 'processing';
ALTER TYPE "order_status" RENAME VALUE 'READY' TO 'ready';
ALTER TYPE "order_status" RENAME VALUE 'COMPLETED' TO 'completed';
ALTER TYPE "order_status" RENAME VALUE 'CANCELLED' TO 'cancelled';

-- fulfillment_type
ALTER TYPE "fulfillment_type" RENAME VALUE 'SHIPPING' TO 'shipping';
ALTER TYPE "fulfillment_type" RENAME VALUE 'PICKUP' TO 'pickup';

-- payment_method
ALTER TYPE "payment_method" RENAME VALUE 'STRIPE' TO 'stripe';
ALTER TYPE "payment_method" RENAME VALUE 'CASH_ON_PICKUP' TO 'cash_on_pickup';
ALTER TYPE "payment_method" RENAME VALUE 'CARD_ON_PICKUP' TO 'card_on_pickup';

-- payment_status
ALTER TYPE "payment_status" RENAME VALUE 'PENDING' TO 'pending';
ALTER TYPE "payment_status" RENAME VALUE 'PAID' TO 'paid';
ALTER TYPE "payment_status" RENAME VALUE 'FAILED' TO 'failed';
ALTER TYPE "payment_status" RENAME VALUE 'REFUNDED' TO 'refunded';

-- loyalty_type
ALTER TYPE "loyalty_type" RENAME VALUE 'EARN' TO 'earn';
ALTER TYPE "loyalty_type" RENAME VALUE 'REDEEM' TO 'redeem';

-- Fix column defaults to match new lowercase enum values
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
ALTER TABLE "products" ALTER COLUMN "animal_age" SET DEFAULT 'all';
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending';

-- Add gen_random_uuid() as DB-level default for all UUID primary keys
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "order_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "loyalty_transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
