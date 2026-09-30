-- Per-user notifications (customer feed) next to the staff inbox. Additive:
-- new nullable columns, an idempotency key with a unique index (NULLs are
-- not compared, so staff rows without a key stay valid), and one more enum
-- value. No row is rewritten.

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'order_status';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "user_id" UUID,
ADD COLUMN "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_key_key" ON "notifications"("key");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
