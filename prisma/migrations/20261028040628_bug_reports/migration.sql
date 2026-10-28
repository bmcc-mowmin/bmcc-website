-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'NEED_INFO', 'FIXED', 'CLOSED', 'WONT_FIX', 'DUPLICATE', 'CANNOT_REPRODUCE');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT,
    "expected" TEXT,
    "pageUrl" TEXT,
    "category" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "area" TEXT,
    "status" "BugStatus" NOT NULL DEFAULT 'NEW',
    "priority" "BugPriority",
    "dueAt" TIMESTAMP(3),
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "reporterId" TEXT,
    "assigneeId" TEXT,
    "duplicateOfId" TEXT,
    "userAgent" TEXT,
    "language" TEXT,
    "viewport" TEXT,
    "triagedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugAttachment" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugEvent" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugAreaOwner" (
    "area" TEXT NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "BugAreaOwner_pkey" PRIMARY KEY ("area")
);

-- CreateIndex
CREATE UNIQUE INDEX "BugReport_number_key" ON "BugReport"("number");

-- CreateIndex
CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_assigneeId_status_idx" ON "BugReport"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BugAttachment_storageKey_key" ON "BugAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "BugEvent_bugId_createdAt_idx" ON "BugEvent"("bugId", "createdAt");

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "BugReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugAttachment" ADD CONSTRAINT "BugAttachment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvent" ADD CONSTRAINT "BugEvent_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvent" ADD CONSTRAINT "BugEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugAreaOwner" ADD CONSTRAINT "BugAreaOwner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
