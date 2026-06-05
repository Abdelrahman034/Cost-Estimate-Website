// features/pricing/pricingService.js
//
// Manages per-company PricingConfig and PriceHistory.

const prisma = require('../../prisma/client');

// ── Default values (mirrors schema defaults) ─────────────────────────────────

const DEFAULTS = {
  ratePackaged:  25,
  rateSplit:     65,
  rateWallMount: 65,
  rateVrf:       75,
  rateFan:       25,
  rateDuct:      25,
  ratePipe:      65,
  rateElec:      65,
  overheadPct:   0.15,
  profitPct:     0.10,
  taxPct:        0.00,
  ductWastePct:  0.10,
  pipeWastePct:  0.10,
  accessoryOverrides:  {},
  unitPricingTables:   null,
  ductPricingTables:   null,
  pipePricingTables:   null,
  fanPricingTables:    null,
  diffuserPricing:     null,
  louverPricing:       null,
  ductPrices:          null,
};

// ── Normalize response ────────────────────────────────────────────────────────
// 1. Expose accessoryPriceOverrides alias (DB col = accessoryOverrides).
// 2. Hoist regionRates out of ductPrices so the frontend reads config.regionRates directly.
function normalizeConfig(config) {
  if (!config) return config;
  const ductPrices   = config.ductPrices ?? null;
  const regionRates  = ductPrices?.regionRates ?? null;
  // Return ductPrices without the regionRates key (keep them separate for clarity)
  const ductPricesClean = ductPrices
    ? (({ regionRates: _r, ...rest }) => rest)(ductPrices)  // eslint-disable-line no-unused-vars
    : null;
  return {
    ...config,
    ductPrices:             ductPricesClean,
    regionRates,
    accessoryPriceOverrides: config.accessoryOverrides ?? {},
  };
}

// ── Get or create config ──────────────────────────────────────────────────────

async function getPricingConfig({ companyId }) {
  const config = await prisma.pricingConfig.findUnique({ where: { companyId } });
  if (!config) {
    return normalizeConfig({ companyId, ...DEFAULTS, _isDefault: true });
  }
  return normalizeConfig(config);
}

// ── Upsert config ─────────────────────────────────────────────────────────────

async function upsertPricingConfig({ companyId, data }) {
  const allowed = [
    'ratePackaged','rateSplit','rateWallMount','rateVrf','rateFan','rateDuct','ratePipe','rateElec',
    'overheadPct','profitPct','taxPct','ductWastePct','pipeWastePct',
    'accessoryOverrides','unitPricingTables','ductPricingTables',
    'pipePricingTables','fanPricingTables','diffuserPricing','louverPricing',
    'copperSettings','ductPrices',
    // regionRates is NOT a separate DB column — handled below by embedding in ductPrices
  ];

  const payload = {};
  for (const key of allowed) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  // Accept the frontend's alias name and map it to the DB field
  if (data.accessoryPriceOverrides !== undefined && payload.accessoryOverrides === undefined) {
    payload.accessoryOverrides = data.accessoryPriceOverrides;
  }

  // regionRates is stored inside ductPrices JSON to avoid a separate column/migration
  if (data.regionRates !== undefined) {
    const existingDuctPrices = payload.ductPrices ?? null;
    payload.ductPrices = { ...(existingDuctPrices ?? {}), regionRates: data.regionRates };
  }

  const result = await prisma.pricingConfig.upsert({
    where:  { companyId },
    update: payload,
    create: { companyId, ...DEFAULTS, ...payload },
  });
  return normalizeConfig(result);
}

// ── Price history ─────────────────────────────────────────────────────────────

async function getPriceHistory({ companyId, limit = 20 }) {
  return prisma.priceHistory.findMany({
    where:   { companyId },
    orderBy: { fetchedAt: 'desc' },
    take:    limit,
    select:  { id: true, source: true, pricesJson: true, fetchedAt: true },
  });
}

async function savePriceSnapshot({ companyId, pricesJson, source = 'manual' }) {
  return prisma.priceHistory.create({
    data: { companyId, pricesJson, source },
  });
}

module.exports = { getPricingConfig, upsertPricingConfig, getPriceHistory, savePriceSnapshot };
