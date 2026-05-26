-- AddColumn: project-level settings overrides
-- Estimators can override company-wide pricing/rates on a per-project basis.
-- Company PricingConfig is never touched by these overrides.

ALTER TABLE "projects" ADD COLUMN "settings_overrides" JSONB DEFAULT NULL;
