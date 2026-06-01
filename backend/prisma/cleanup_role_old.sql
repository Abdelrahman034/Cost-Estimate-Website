DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role_old') THEN
    DROP TYPE "Role_old";
  END IF;
END $$;
