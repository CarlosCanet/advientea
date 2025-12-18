/*
  Warnings:

  - You are about to drop the column `guessedGuestName` on the `TeaGuess` table. All the data in the column will be lost.
  - You are about to drop the column `guessedUserId` on the `TeaGuess` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TeaGuess" DROP CONSTRAINT "TeaGuess_guessedUserId_fkey";

-- AlterTable
ALTER TABLE "TeaGuess" DROP COLUMN "guessedGuestName",
DROP COLUMN "guessedUserId",
ADD COLUMN     "guessedPersonName" TEXT;
