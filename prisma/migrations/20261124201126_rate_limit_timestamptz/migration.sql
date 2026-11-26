-- AlterTable
ALTER TABLE "RateLimit" ALTER COLUMN "windowStart" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
