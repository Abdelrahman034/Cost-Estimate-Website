-- Migration: Rename ADMIN→OWNER, remove ESTIMATOR, add custom roles
-- Written to be safe against partial previous runs.

-- 1. Rename Role → Role_old only if Role_old doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_old') THEN
    ALTER TYPE "Role" RENAME TO "Role_old";
  END IF;
END $$;

-- 2. Create new Role enum only if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('OWNER');
  END IF;
END $$;

-- 3. Migrate users.role column: ADMIN→OWNER, ESTIMATOR→NULL
--    Only if the column is still using Role_old (check via pg_attribute)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_attribute a
    JOIN   pg_class     c ON c.oid = a.attrelid
    JOIN   pg_type      t ON t.oid = a.atttypid
    WHERE  c.relname = 'users'
    AND    a.attname = 'role'
    AND    t.typname = 'Role_old'
  ) THEN
    ALTER TABLE "users"
      ALTER COLUMN "role" DROP DEFAULT,
      ALTER COLUMN "role" DROP NOT NULL,
      ALTER COLUMN "role" TYPE "Role"
        USING CASE "role"::text
          WHEN 'ADMIN'     THEN 'OWNER'::"Role"
          WHEN 'ESTIMATOR' THEN NULL
          ELSE NULL
        END;
  END IF;
END $$;

-- 4. Migrate invites.role column the same way
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_attribute a
    JOIN   pg_class     c ON c.oid = a.attrelid
    JOIN   pg_type      t ON t.oid = a.atttypid
    WHERE  c.relname = 'invites'
    AND    a.attname = 'role'
    AND    t.typname = 'Role_old'
  ) THEN
    ALTER TABLE "invites"
      ALTER COLUMN "role" DROP DEFAULT,
      ALTER COLUMN "role" DROP NOT NULL,
      ALTER COLUMN "role" TYPE "Role"
        USING CASE "role"::text
          WHEN 'ADMIN'     THEN 'OWNER'::"Role"
          WHEN 'ESTIMATOR' THEN NULL
          ELSE NULL
        END;
  END IF;
END $$;

-- 5. Drop the old enum if it still exists
DROP TYPE IF EXISTS "Role_old";

-- 6. Create custom_roles table
CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id"          TEXT         NOT NULL,
  "company_id"  TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "permissions" JSONB        NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custom_roles_company_id_fkey'
  ) THEN
    ALTER TABLE "custom_roles"
      ADD CONSTRAINT "custom_roles_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "custom_roles_company_id_idx" ON "custom_roles"("company_id");

-- 7. Add custom_role_id to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_role_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_custom_role_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_custom_role_id_fkey"
      FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 8. Add custom_role_id to invites
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "custom_role_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_custom_role_id_fkey'
  ) THEN
    ALTER TABLE "invites"
      ADD CONSTRAINT "invites_custom_role_id_fkey"
      FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
