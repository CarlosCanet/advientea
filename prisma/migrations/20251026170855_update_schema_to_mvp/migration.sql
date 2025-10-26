/*
  Warnings:

  - You are about to drop the column `addMilk` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `canReinfuse` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `hasTheine` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `moreIndications` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `reinfuseNumber` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Day` table. All the data in the column will be lost.
  - Added the required column `dayId` to the `StoryTea` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Tea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "infusionTime" INTEGER NOT NULL,
    "temperature" INTEGER NOT NULL,
    "hasTheine" BOOLEAN NOT NULL,
    "canReinfuse" BOOLEAN NOT NULL,
    "reinfuseNumber" INTEGER,
    "moreIndications" TEXT NOT NULL,
    "addMilk" BOOLEAN NOT NULL DEFAULT false,
    "storeName" TEXT,
    "url" TEXT,
    CONSTRAINT "Tea_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    CONSTRAINT "DayAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DayAssignment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyTeaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryImage_storyTeaId_fkey" FOREIGN KEY ("storyTeaId") REFERENCES "StoryTea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Day" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2025
);
INSERT INTO "new_Day" ("dayNumber", "id") SELECT "dayNumber", "id" FROM "Day";
DROP TABLE "Day";
ALTER TABLE "new_Day" RENAME TO "Day";
CREATE UNIQUE INDEX "Day_dayNumber_year_key" ON "Day"("dayNumber", "year");
CREATE TABLE "new_StoryTea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "storyPart1" TEXT NOT NULL,
    "storyPart2" TEXT NOT NULL,
    "storyPart3" TEXT NOT NULL,
    "youtubeURL" TEXT,
    "onlyMusic" BOOLEAN,
    CONSTRAINT "StoryTea_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StoryTea" ("id", "onlyMusic", "storyPart1", "storyPart2", "storyPart3", "youtubeURL") SELECT "id", "onlyMusic", "storyPart1", "storyPart2", "storyPart3", "youtubeURL" FROM "StoryTea";
DROP TABLE "StoryTea";
ALTER TABLE "new_StoryTea" RENAME TO "StoryTea";
CREATE UNIQUE INDEX "StoryTea_dayId_key" ON "StoryTea"("dayId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tea_dayId_key" ON "Tea"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "DayAssignment_dayId_key" ON "DayAssignment"("dayId");

-- CreateIndex
CREATE INDEX "DayAssignment_year_idx" ON "DayAssignment"("year");

-- CreateIndex
CREATE UNIQUE INDEX "DayAssignment_userId_year_key" ON "DayAssignment"("userId", "year");

-- CreateIndex
CREATE INDEX "StoryImage_storyTeaId_order_idx" ON "StoryImage"("storyTeaId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
