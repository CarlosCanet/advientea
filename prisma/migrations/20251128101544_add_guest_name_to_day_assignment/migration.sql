-- AlterTable
ALTER TABLE "DayAssignment" ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;
