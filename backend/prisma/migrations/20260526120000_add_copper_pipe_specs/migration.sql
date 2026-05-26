-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add_copper_pipe_specs
-- Adds two global reference tables for the copper pricing engine:
--   copper_pipe_specs         — ASTM B88/B280 weights + Grainger calibration data
--   copper_equipment_configs  — per-equip-type/tonnage baseline prices + pipe configs
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateTable: copper_pipe_specs
CREATE TABLE "copper_pipe_specs" (
    "id"                        TEXT        NOT NULL,
    "nominal_size"              TEXT        NOT NULL,
    "sort_order"                INTEGER     NOT NULL DEFAULT 0,
    "weight_k_lb_per_ft"        DECIMAL(6,4) NOT NULL,
    "weight_l_lb_per_ft"        DECIMAL(6,4) NOT NULL,
    "weight_m_lb_per_ft"        DECIMAL(6,4) NOT NULL,
    "distribution_factor"       DECIMAL(6,4) NOT NULL,
    "vrv_baseline_price_per_ft" DECIMAL(7,4),
    "insulation_cost_per_ft"    DECIMAL(6,4) NOT NULL,
    "updated_at"                TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copper_pipe_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: copper_equipment_configs
CREATE TABLE "copper_equipment_configs" (
    "id"                        TEXT         NOT NULL,
    "equip_type"                TEXT         NOT NULL,
    "tonnage"                   INTEGER      NOT NULL,
    "liquid_pipe_size"          TEXT,
    "suction_pipe_size"         TEXT,
    "avg_length_short_ft"       DECIMAL(7,2),
    "avg_length_long_ft"        DECIMAL(7,2),
    "baseline_copper_l_short"   DECIMAL(10,2),
    "baseline_copper_l_long"    DECIMAL(10,2),
    "baseline_copper_roll_short" DECIMAL(10,2),
    "baseline_copper_roll_long" DECIMAL(10,2),
    "baseline_short"            DECIMAL(10,2),
    "baseline_long"             DECIMAL(10,2),
    "vrv_base_per_ft"           DECIMAL(7,4),
    "vrv_blended_weight_per_ft" DECIMAL(6,4),
    "vrv_insulation_per_ft"     DECIMAL(5,4),
    "updated_at"                TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copper_equipment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique + performance)
CREATE UNIQUE INDEX "copper_pipe_specs_nominal_size_key"
    ON "copper_pipe_specs"("nominal_size");

CREATE INDEX "copper_pipe_specs_sort_order_idx"
    ON "copper_pipe_specs"("sort_order");

CREATE UNIQUE INDEX "copper_equipment_configs_equip_type_tonnage_key"
    ON "copper_equipment_configs"("equip_type", "tonnage");

CREATE INDEX "copper_equipment_configs_equip_type_idx"
    ON "copper_equipment_configs"("equip_type");
