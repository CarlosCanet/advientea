-- CreateEnum
CREATE TYPE "TeaType" AS ENUM ('BLACK', 'GREEN', 'RED', 'WHITE', 'OOLONG', 'ROOIBOS', 'HERBAL', 'MATE', 'CHAI', 'MATCHA', 'BLEND');

-- AlterTable
ALTER TABLE "Tea" ADD COLUMN     "teaType" "TeaType" NOT NULL DEFAULT 'BLEND',
ALTER COLUMN "dayId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TeaIngredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TeaIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeaGuess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "guessedTeaName" TEXT,
    "guessedTeaType" "TeaType",
    "guessedUserId" TEXT,
    "guessedGuestName" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeaGuess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TeaIngredients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeaIngredients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GuessedIngredients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GuessedIngredients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeaIngredient_name_key" ON "TeaIngredient"("name");

-- CreateIndex
CREATE INDEX "TeaGuess_dayId_idx" ON "TeaGuess"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "TeaGuess_userId_dayId_key" ON "TeaGuess"("userId", "dayId");

-- CreateIndex
CREATE INDEX "_TeaIngredients_B_index" ON "_TeaIngredients"("B");

-- CreateIndex
CREATE INDEX "_GuessedIngredients_B_index" ON "_GuessedIngredients"("B");

-- AddForeignKey
ALTER TABLE "TeaGuess" ADD CONSTRAINT "TeaGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeaGuess" ADD CONSTRAINT "TeaGuess_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeaGuess" ADD CONSTRAINT "TeaGuess_guessedUserId_fkey" FOREIGN KEY ("guessedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeaIngredients" ADD CONSTRAINT "_TeaIngredients_A_fkey" FOREIGN KEY ("A") REFERENCES "Tea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeaIngredients" ADD CONSTRAINT "_TeaIngredients_B_fkey" FOREIGN KEY ("B") REFERENCES "TeaIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuessedIngredients" ADD CONSTRAINT "_GuessedIngredients_A_fkey" FOREIGN KEY ("A") REFERENCES "TeaGuess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuessedIngredients" ADD CONSTRAINT "_GuessedIngredients_B_fkey" FOREIGN KEY ("B") REFERENCES "TeaIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
