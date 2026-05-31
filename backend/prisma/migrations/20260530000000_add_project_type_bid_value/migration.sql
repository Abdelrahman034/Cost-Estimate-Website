-- CreateEnum (safe — skips if already exists)
DO $$ BEGIN
  CREATE TYPE "ProjectType" AS ENUM ('COMMERCIAL', 'PUBLIC', 'MULTI_FAMILY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (safe — skips columns that already exist)
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "project_type" "ProjectType",
  ADD COLUMN IF NOT EXISTS "bid_value"    DOUBLE PRECISION;
