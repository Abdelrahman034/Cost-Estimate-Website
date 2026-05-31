-- Add area, submissionStatus, marginPct to projects table

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "area"               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "submission_status"  TEXT,
  ADD COLUMN IF NOT EXISTS "margin_pct"         DECIMAL(5, 4);
