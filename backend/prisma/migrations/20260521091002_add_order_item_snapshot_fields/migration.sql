-- AlterTable: Add product snapshot fields to order_items
-- Existing rows get placeholder values
ALTER TABLE "order_items" 
ADD COLUMN "product_name" TEXT NOT NULL DEFAULT 'Unknown Product',
ADD COLUMN "product_price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Remove the defaults after backfill (columns are required going forward)
ALTER TABLE "order_items" ALTER COLUMN "product_name" DROP DEFAULT;
ALTER TABLE "order_items" ALTER COLUMN "product_price" DROP DEFAULT;