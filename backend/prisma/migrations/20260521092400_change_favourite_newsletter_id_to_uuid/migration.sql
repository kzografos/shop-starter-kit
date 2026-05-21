/*
  Warnings:

  - The primary key for the `favourites` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `newsletter_subscribers` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "favourites" DROP CONSTRAINT "favourites_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "favourites_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "favourites_id_seq";

-- AlterTable
ALTER TABLE "newsletter_subscribers" DROP CONSTRAINT "newsletter_subscribers_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "newsletter_subscribers_id_seq";
