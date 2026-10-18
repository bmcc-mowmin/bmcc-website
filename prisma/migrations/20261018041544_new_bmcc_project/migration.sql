-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "collection" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CampaignSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "goalCents" INTEGER,
    "offlineRaisedCents" INTEGER NOT NULL DEFAULT 0,
    "raisedAsOf" TIMESTAMP(3),
    "showProgress" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignUpdate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignUpdate_published_date_idx" ON "CampaignUpdate"("published", "date");
