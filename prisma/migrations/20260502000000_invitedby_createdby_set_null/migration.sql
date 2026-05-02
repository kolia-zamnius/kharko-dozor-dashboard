-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invite" DROP CONSTRAINT "Invite_invitedById_fkey";

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "invitedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
