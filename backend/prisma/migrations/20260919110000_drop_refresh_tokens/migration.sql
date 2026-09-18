-- The refresh_tokens table has been dead since refresh tokens moved to Redis
-- (`refresh:<userId>:<jti>`): nothing reads or writes it, and the live
-- database holds zero rows. Dropping it is a schema-only change.

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "refresh_tokens";
