-- Order creation idempotency (POST /orders `Idempotency-Key`). Additive: two
-- nullable columns and a unique index that ignores NULLs, so every existing
-- order is untouched and orders placed without a key stay valid.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT,
ADD COLUMN "idempotency_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
