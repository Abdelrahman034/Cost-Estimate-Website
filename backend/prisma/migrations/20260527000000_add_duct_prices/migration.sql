-- Add duct_prices JSON column to pricing_configs
-- Stores Metal Duct module material/labor rates at the company level.
-- e.g. { "sheetMetalCostPerLb": 4.00, "insulationPerSqFt": 1.25, ... }

ALTER TABLE "pricing_configs" ADD COLUMN IF NOT EXISTS "duct_prices" JSONB;
