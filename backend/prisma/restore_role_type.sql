-- Recovery script: undo the partial migration that renamed Role → Role_old
-- Run this ONCE to restore the original state, then re-run migrate deploy.

-- Step 1: Drop the new (empty) Role type if it was partially created
DROP TYPE IF EXISTS "Role";

-- Step 2: Rename Role_old back to Role (restores original state)
ALTER TYPE "Role_old" RENAME TO "Role";

-- Step 3: Restore the column defaults that were dropped by the failed migration
-- (only needed if the migration got far enough to drop them)
ALTER TABLE "users"   ALTER COLUMN "role" SET DEFAULT 'ESTIMATOR'::"Role";
ALTER TABLE "invites" ALTER COLUMN "role" SET DEFAULT 'ESTIMATOR'::"Role";
