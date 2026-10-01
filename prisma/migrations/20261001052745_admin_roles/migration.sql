-- Admin portal roles replace the single ADMIN/MEMBER role.
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_EDITOR', 'PRAYER_MANAGER', 'MEMBERSHIP_COORDINATOR', 'TREASURER');

ALTER TABLE "User"
  ADD COLUMN "adminRoles" "AdminRole"[] DEFAULT ARRAY[]::"AdminRole"[],
  ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Existing admins keep full access.
UPDATE "User" SET "adminRoles" = ARRAY['SUPER_ADMIN']::"AdminRole"[] WHERE "role" = 'ADMIN';

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- Where prayer times come from ("builtin" or an external provider).
ALTER TABLE "PrayerSettings" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'builtin';

-- One-time links (admin invites: "set your password").
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
