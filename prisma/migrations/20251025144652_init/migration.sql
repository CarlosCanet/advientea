-- CreateTable
CREATE TABLE "Day" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "hasTheine" BOOLEAN NOT NULL,
    "canReinfuse" BOOLEAN NOT NULL,
    "reinfuseNumber" INTEGER,
    "moreIndications" TEXT NOT NULL,
    "addMilk" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "StoryTea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyPart1" TEXT NOT NULL,
    "storyPart2" TEXT NOT NULL,
    "storyPart3" TEXT NOT NULL,
    "youtubeURL" TEXT,
    "onlyMusic" BOOLEAN,
    CONSTRAINT "StoryTea_id_fkey" FOREIGN KEY ("id") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Day_dayNumber_key" ON "Day"("dayNumber");
