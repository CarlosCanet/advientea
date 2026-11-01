/*
  Warnings:

  - A unique constraint covering the columns `[guestToken]` on the table `DayAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- Guard: the random guest days of 2025 were deleted by hand before this migration. If one
-- reappears (the public guest form is still open in production and it creates the day WITH a guest
-- assignment), stop before touching anything.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Day" WHERE "dayNumber" > 25) THEN
    RAISE EXCEPTION 'Day with dayNumber > 25 found: delete the guest day before migrating';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PREPARING');

-- DropForeignKey
ALTER TABLE "DayAssignment" DROP CONSTRAINT "DayAssignment_dayId_fkey";

-- DropForeignKey
ALTER TABLE "DayAssignment" DROP CONSTRAINT "DayAssignment_userId_fkey";

-- AlterTable
ALTER TABLE "Day" ALTER COLUMN "year" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DayAssignment" ADD COLUMN     "guestToken" TEXT,
ALTER COLUMN "dayId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Edition" (
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'PREPARING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayAssignment_guestToken_key" ON "DayAssignment"("guestToken");

-- Backfill: one edition per year already present in days or assignments. Past years are
-- archived; the current year, if any day exists, is still being prepared.
INSERT INTO "Edition" ("year", "name", "status")
SELECT y."year",
       'Advienté ' || y."year",
       CASE WHEN y."year" < EXTRACT(YEAR FROM now()) THEN 'ARCHIVED' ELSE 'PREPARING' END::"EditionStatus"
FROM (SELECT "year" FROM "Day" UNION SELECT "year" FROM "DayAssignment") AS y;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_year_fkey" FOREIGN KEY ("year") REFERENCES "Edition"("year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayAssignment" ADD CONSTRAINT "DayAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayAssignment" ADD CONSTRAINT "DayAssignment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayAssignment" ADD CONSTRAINT "DayAssignment_year_fkey" FOREIGN KEY ("year") REFERENCES "Edition"("year") ON DELETE RESTRICT ON UPDATE CASCADE;
