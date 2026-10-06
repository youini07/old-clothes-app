-- AlterTable
ALTER TABLE "User" ADD COLUMN "eventText" TEXT;
ALTER TABLE "User" ADD COLUMN "eventIsActive" BOOLEAN NOT NULL DEFAULT false;
