-- AlterTable
ALTER TABLE "GlobalSettings" ADD COLUMN "popupImageUrl" TEXT,
ADD COLUMN "popupIsActive" BOOLEAN NOT NULL DEFAULT false;
