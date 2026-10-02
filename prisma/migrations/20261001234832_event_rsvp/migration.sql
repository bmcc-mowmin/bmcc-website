-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rsvpCapacity" INTEGER,
ADD COLUMN     "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false;
