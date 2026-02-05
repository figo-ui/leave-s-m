-- Add language preference to users
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
