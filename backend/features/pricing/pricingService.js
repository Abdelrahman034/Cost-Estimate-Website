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

// ── Normalize response — expose accessoryPriceOverrides alias ────────────────
// The DB column is accessoryOverrides; the frontend uses accessoryPriceOverrides.
// We expose both keys so the frontend context can read it by the new name.
function normalizeConfig(config) {
  if (!config) return config;
  return {
    ...config,
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
  ];

  const payload = {};
  for (const key of allowed) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  // Accept the frontend's alias name and map it to the DB field
  if (data.accessoryPriceOverrides !== undefined && payload.accessoryOverrides === undefined) {
    payload.accessoryOverrides = data.accessoryPriceOverrides;
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
