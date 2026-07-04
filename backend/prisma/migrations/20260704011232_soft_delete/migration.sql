-- AlterTable
ALTER TABLE "GlobalSettings" ADD COLUMN     "deletePassword" TEXT NOT NULL DEFAULT '9436';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
