-- Migration: Remove CW_PIPE module
-- Drops the cw_pipe_items table and removes CW_PIPE from the ModuleType enum.

-- 1. Drop the table (cascade removes indexes and FK automatically)
DROP TABLE IF EXISTS "cw_pipe_items";

-- 2. Delete any estimates saved with module = 'CW_PIPE'
DELETE FROM "estimates" WHERE "module" = 'CW_PIPE';

-- 3. Swap the ModuleType enum to remove CW_PIPE
ALTER TYPE "ModuleType" RENAME TO "ModuleType_old";
CREATE TYPE "ModuleType" AS ENUM (
  'UNIT_SCHEDULE',
  'METAL_DUCT',
  'VAV_SCHEDULE',
  'ELECTRIC_HEAT',
  'FAN_SCHEDULE',
  'LOUVERS_DAMPERS',
  'DIFFUSER_SCHEDULE',
  'GENERAL_ITEMS',
  'SUMMARY'
);

ALTER TABLE "estimates" ALTER COLUMN "module" TYPE "ModuleType" USING "module"::text::"ModuleType";

DROP TYPE "ModuleType_old";
