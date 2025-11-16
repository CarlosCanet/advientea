/*
  Warnings:

  - Added the required column `updatedAt` to the `Day` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DayAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StoryImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StoryTea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Tea` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Day" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2025,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Day" ("dayNumber", "id", "year") SELECT "dayNumber", "id", "year" FROM "Day";
DROP TABLE "Day";
ALTER TABLE "new_Day" RENAME TO "Day";
CREATE UNIQUE INDEX "Day_dayNumber_year_key" ON "Day"("dayNumber", "year");
CREATE TABLE "new_DayAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DayAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DayAssignment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DayAssignment" ("dayId", "id", "userId", "year") SELECT "dayId", "id", "userId", "year" FROM "DayAssignment";
DROP TABLE "DayAssignment";
ALTER TABLE "new_DayAssignment" RENAME TO "DayAssignment";
CREATE UNIQUE INDEX "DayAssignment_dayId_key" ON "DayAssignment"("dayId");
CREATE INDEX "DayAssignment_year_idx" ON "DayAssignment"("year");
CREATE UNIQUE INDEX "DayAssignment_userId_year_key" ON "DayAssignment"("userId", "year");
CREATE TABLE "new_StoryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyTeaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryImage_storyTeaId_fkey" FOREIGN KEY ("storyTeaId") REFERENCES "StoryTea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StoryImage" ("createdAt", "id", "order", "publicId", "storyTeaId", "url") SELECT "createdAt", "id", "order", "publicId", "storyTeaId", "url" FROM "StoryImage";
DROP TABLE "StoryImage";
ALTER TABLE "new_StoryImage" RENAME TO "StoryImage";
CREATE INDEX "StoryImage_storyTeaId_order_idx" ON "StoryImage"("storyTeaId", "order");
CREATE TABLE "new_StoryTea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "storyPart1" TEXT NOT NULL,
    "storyPart2" TEXT NOT NULL,
    "storyPart3" TEXT NOT NULL,
    "youtubeURL" TEXT,
    "onlyMusic" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryTea_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StoryTea" ("dayId", "id", "onlyMusic", "storyPart1", "storyPart2", "storyPart3", "youtubeURL") SELECT "dayId", "id", "onlyMusic", "storyPart1", "storyPart2", "storyPart3", "youtubeURL" FROM "StoryTea";
DROP TABLE "StoryTea";
ALTER TABLE "new_StoryTea" RENAME TO "StoryTea";
CREATE UNIQUE INDEX "StoryTea_dayId_key" ON "StoryTea"("dayId");
CREATE TABLE "new_Tea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "infusionTime" INTEGER NOT NULL,
    "temperature" INTEGER NOT NULL,
    "hasTheine" BOOLEAN NOT NULL,
    "canReinfuse" BOOLEAN NOT NULL,
    "reinfuseNumber" INTEGER,
    "moreIndications" TEXT,
    "addMilk" BOOLEAN NOT NULL DEFAULT false,
    "storeName" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tea_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tea" ("addMilk", "canReinfuse", "dayId", "hasTheine", "id", "infusionTime", "moreIndications", "name", "reinfuseNumber", "storeName", "temperature", "url") SELECT "addMilk", "canReinfuse", "dayId", "hasTheine", "id", "infusionTime", "moreIndications", "name", "reinfuseNumber", "storeName", "temperature", "url" FROM "Tea";
DROP TABLE "Tea";
ALTER TABLE "new_Tea" RENAME TO "Tea";
CREATE UNIQUE INDEX "Tea_dayId_key" ON "Tea"("dayId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
