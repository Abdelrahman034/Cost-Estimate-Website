-- Migration: Remove VIEWER role
-- PostgreSQL cannot auto-cast column defaults when changing an enum type,
-- so we must: drop defaults → migrate data → swap enum → restore defaults.

-- 1. Migrate any VIEWER rows to ESTIMATOR before touching the type
UPDATE "users"   SET "role" = 'ESTIMATOR' WHERE "role" = 'VIEWER';
UPDATE "invites" SET "role" = 'ESTIMATOR' WHERE "role" = 'VIEWER';

-- 2. Drop column defaults (PostgreSQL requires this before ALTER COLUMN TYPE)
ALTER TABLE "users"   ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invites" ALTER COLUMN "role" DROP DEFAULT;

-- 3. Swap enum: rename old → create new without VIEWER → cast columns
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ESTIMATOR');

ALTER TABLE "users"   ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "invites" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";

DROP TYPE "Role_old";

-- 4. Restore column defaults
ALTER TABLE "users"   ALTER COLUMN "role" SET DEFAULT 'ESTIMATOR'::"Role";
ALTER TABLE "invites" ALTER COLUMN "role" SET DEFAULT 'ESTIMATOR'::"Role";
