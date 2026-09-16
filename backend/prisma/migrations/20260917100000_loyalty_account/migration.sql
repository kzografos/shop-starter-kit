-- Seam 2: loyalty balance moves from users.loyalty_points to its own table.
-- Hand-written and data-preserving: every existing user gets an account row
-- carrying the exact balance they had, then the column is dropped. Runs in
-- one transaction (Prisma wraps the file), so a failure leaves users intact.

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one account per existing user with the balance they hold today.
INSERT INTO "loyalty_accounts" ("user_id", "points")
SELECT "id", "loyalty_points" FROM "users";

-- DropColumn
ALTER TABLE "users" DROP COLUMN "loyalty_points";
