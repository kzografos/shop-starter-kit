-- users.role: enum user_role -> text. Values are preserved verbatim (lowercase);
-- NOT NULL and the 'customer' default are kept. Hand-written: Prisma's generated
-- form drops and re-adds the column, which would reset every user to 'customer'.
-- The default is dropped first because it is typed as the enum and Postgres
-- refuses to change the column type while it is in place.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
DROP TYPE "user_role";
