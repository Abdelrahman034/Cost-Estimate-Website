-- Migration: Add isolated module tables
-- Each module gets its own table linked to estimates.id via FK.
-- The existing estimate_rows table is NOT modified (backward compatible).
-- To add a new module in the future: add a new CREATE TABLE here + register
-- it in features/modules/moduleRegistry.js. No existing tables are touched.

-- ── Unit Schedule Items ───────────────────────────────────────────────────────
CREATE TABLE "unit_schedule_items" (
    "id"           TEXT NOT NULL,
    "estimate_id"  TEXT NOT NULL,
    "sort_order"   INTEGER NOT NULL DEFAULT 0,
    "tag"          TEXT,
    "unit_type"    TEXT,
    "qty"          INTEGER,
    "tons"         DECIMAL(8,2),
    "system_type"  TEXT,
    "material"     DECIMAL(12,2),
    "labor"        DECIMAL(12,2),
    "hours"        DECIMAL(10,2),
    "total"        DECIMAL(12,2),
    "row_data"     JSONB NOT NULL,
    "result_data"  JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unit_schedule_items_pkey" PRIMARY KEY ("id")
);

-- ── Metal Duct Items ──────────────────────────────────────────────────────────
CREATE TABLE "metal_duct_items" (
    "id"               TEXT NOT NULL,
    "estimate_id"      TEXT NOT NULL,
    "sort_order"       INTEGER NOT NULL DEFAULT 0,
    "duct_size"        TEXT,
    "shape"            TEXT,
    "length_ft"        DECIMAL(10,2),
    "surface_area_sqft" DECIMAL(10,2),
    "gauge"            INTEGER,
    "weight_lb"        DECIMAL(10,2),
    "material"         DECIMAL(12,2),
    "labor"            DECIMAL(12,2),
    "hours"            DECIMAL(10,2),
    "total"            DECIMAL(12,2),
    "row_data"         JSONB NOT NULL,
    "result_data"      JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "metal_duct_items_pkey" PRIMARY KEY ("id")
);

-- ── Chilled Water Pipe Items ──────────────────────────────────────────────────
CREATE TABLE "cw_pipe_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "pipe_size"   TEXT,
    "pipe_type"   TEXT,
    "length_ft"   DECIMAL(10,2),
    "waste_pct"   DECIMAL(5,4),
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cw_pipe_items_pkey" PRIMARY KEY ("id")
);

-- ── VAV Items ─────────────────────────────────────────────────────────────────
CREATE TABLE "vav_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "tag"         TEXT,
    "vav_type"    TEXT,
    "cfm"         DECIMAL(10,2),
    "qty"         INTEGER,
    "has_reheat"  BOOLEAN,
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vav_items_pkey" PRIMARY KEY ("id")
);

-- ── Electric Heat Items ───────────────────────────────────────────────────────
CREATE TABLE "electric_heat_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "tag"         TEXT,
    "kw"          DECIMAL(8,2),
    "volts"       INTEGER,
    "qty"         INTEGER,
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "electric_heat_items_pkey" PRIMARY KEY ("id")
);

-- ── Fan Items ─────────────────────────────────────────────────────────────────
CREATE TABLE "fan_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "tag"         TEXT,
    "fan_type"    TEXT,
    "cfm"         DECIMAL(10,2),
    "hp"          DECIMAL(6,2),
    "qty"         INTEGER,
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fan_items_pkey" PRIMARY KEY ("id")
);

-- ── Louver / Fire Damper Items ────────────────────────────────────────────────
CREATE TABLE "louver_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "tag"         TEXT,
    "item_type"   TEXT,
    "width"       DECIMAL(8,2),
    "height"      DECIMAL(8,2),
    "qty"         INTEGER,
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "louver_items_pkey" PRIMARY KEY ("id")
);

-- ── Diffuser Items ────────────────────────────────────────────────────────────
CREATE TABLE "diffuser_items" (
    "id"            TEXT NOT NULL,
    "estimate_id"   TEXT NOT NULL,
    "sort_order"    INTEGER NOT NULL DEFAULT 0,
    "tag"           TEXT,
    "diffuser_type" TEXT,
    "size"          TEXT,
    "qty"           INTEGER,
    "material"      DECIMAL(12,2),
    "labor"         DECIMAL(12,2),
    "hours"         DECIMAL(10,2),
    "total"         DECIMAL(12,2),
    "row_data"      JSONB NOT NULL,
    "result_data"   JSONB,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "diffuser_items_pkey" PRIMARY KEY ("id")
);

-- ── General Items ─────────────────────────────────────────────────────────────
CREATE TABLE "general_items" (
    "id"          TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "module_type" TEXT,
    "qty"         DECIMAL(10,2),
    "unit"        TEXT,
    "material"    DECIMAL(12,2),
    "labor"       DECIMAL(12,2),
    "hours"       DECIMAL(10,2),
    "total"       DECIMAL(12,2),
    "row_data"    JSONB NOT NULL,
    "result_data" JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "general_items_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX "unit_schedule_items_estimate_id_idx"            ON "unit_schedule_items"("estimate_id");
CREATE INDEX "unit_schedule_items_estimate_id_sort_order_idx" ON "unit_schedule_items"("estimate_id", "sort_order");

CREATE INDEX "metal_duct_items_estimate_id_idx"               ON "metal_duct_items"("estimate_id");
CREATE INDEX "metal_duct_items_estimate_id_sort_order_idx"    ON "metal_duct_items"("estimate_id", "sort_order");

CREATE INDEX "cw_pipe_items_estimate_id_idx"                  ON "cw_pipe_items"("estimate_id");
CREATE INDEX "cw_pipe_items_estimate_id_sort_order_idx"       ON "cw_pipe_items"("estimate_id", "sort_order");

CREATE INDEX "vav_items_estimate_id_idx"                      ON "vav_items"("estimate_id");
CREATE INDEX "vav_items_estimate_id_sort_order_idx"           ON "vav_items"("estimate_id", "sort_order");

CREATE INDEX "electric_heat_items_estimate_id_idx"            ON "electric_heat_items"("estimate_id");
CREATE INDEX "electric_heat_items_estimate_id_sort_order_idx" ON "electric_heat_items"("estimate_id", "sort_order");

CREATE INDEX "fan_items_estimate_id_idx"                      ON "fan_items"("estimate_id");
CREATE INDEX "fan_items_estimate_id_sort_order_idx"           ON "fan_items"("estimate_id", "sort_order");

CREATE INDEX "louver_items_estimate_id_idx"                   ON "louver_items"("estimate_id");
CREATE INDEX "louver_items_estimate_id_sort_order_idx"        ON "louver_items"("estimate_id", "sort_order");

CREATE INDEX "diffuser_items_estimate_id_idx"                 ON "diffuser_items"("estimate_id");
CREATE INDEX "diffuser_items_estimate_id_sort_order_idx"      ON "diffuser_items"("estimate_id", "sort_order");

CREATE INDEX "general_items_estimate_id_idx"                  ON "general_items"("estimate_id");
CREATE INDEX "general_items_estimate_id_sort_order_idx"       ON "general_items"("estimate_id", "sort_order");

-- ── Foreign Keys (all cascade-delete with parent estimate) ────────────────────
ALTER TABLE "unit_schedule_items"  ADD CONSTRAINT "unit_schedule_items_estimate_id_fkey"  FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metal_duct_items"     ADD CONSTRAINT "metal_duct_items_estimate_id_fkey"     FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cw_pipe_items"        ADD CONSTRAINT "cw_pipe_items_estimate_id_fkey"        FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vav_items"            ADD CONSTRAINT "vav_items_estimate_id_fkey"            FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "electric_heat_items"  ADD CONSTRAINT "electric_heat_items_estimate_id_fkey"  FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fan_items"            ADD CONSTRAINT "fan_items_estimate_id_fkey"            FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "louver_items"         ADD CONSTRAINT "louver_items_estimate_id_fkey"         FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diffuser_items"       ADD CONSTRAINT "diffuser_items_estimate_id_fkey"       FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_items"        ADD CONSTRAINT "general_items_estimate_id_fkey"        FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
