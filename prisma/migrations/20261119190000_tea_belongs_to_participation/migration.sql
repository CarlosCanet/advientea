-- A tea now belongs to its participation instead of to a day: the day is reached through the
-- participation, so a tea follows its owner when the owner moves and can exist before a day is given.

-- Guard: every tea must reach a participation through its day. A tea with no day, or on a day
-- nobody holds, has no owner to hang from; stop before touching anything and decide by hand.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Tea" t
    LEFT JOIN "DayAssignment" p ON p."dayId" = t."dayId"
    WHERE p."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Tea without a participation found (no day, or a day nobody holds): give it an owner or delete it before migrating';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Tea" ADD COLUMN "participationId" TEXT;

-- Backfill: the participation that holds the day of each tea.
UPDATE "Tea" t
SET "participationId" = p."id"
FROM "DayAssignment" p
WHERE p."dayId" = t."dayId";

ALTER TABLE "Tea" ALTER COLUMN "participationId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Tea" DROP CONSTRAINT "Tea_dayId_fkey";

-- DropIndex
DROP INDEX "Tea_dayId_key";

-- AlterTable
ALTER TABLE "Tea" DROP COLUMN "dayId";

-- CreateIndex
CREATE UNIQUE INDEX "Tea_participationId_key" ON "Tea"("participationId");

-- AddForeignKey
ALTER TABLE "Tea" ADD CONSTRAINT "Tea_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "DayAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
