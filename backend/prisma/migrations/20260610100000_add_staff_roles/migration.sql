-- AlterEnum: add staff roles to user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'stock_manager';
