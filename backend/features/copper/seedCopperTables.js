#!/usr/bin/env node
'use strict';
/**
 * seedCopperTables.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Upserts calibrated copper reference data into copper_pipe_specs and
 * copper_equipment_configs.  Safe to re-run: uses upsert on natural keys.
 *
 * Usage:
 *   node backend/features/copper/seedCopperTables.js
 *
 * Run after every migration or any time you need to restore calibrated defaults.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const prisma = require('../../prisma/client');
const { PIPE_SPECS, EQUIPMENT_CONFIGS } = require('./copperSeedData');

async function seed() {
  console.log('\n🔧  Seeding copper reference tables…\n');

  // ── 1. Pipe Specs ───────────────────────────────────────────────────────────
  let specCount = 0;
  for (const spec of PIPE_SPECS) {
    await prisma.copperPipeSpec.upsert({
      where:  { nominalSize: spec.nominalSize },
      update: {
        sortOrder:             spec.sortOrder,
        weightKLbPerFt:        spec.weightKLbPerFt,
        weightLLbPerFt:        spec.weightLLbPerFt,
        weightMLbPerFt:        spec.weightMLbPerFt,
        distributionFactor:    spec.distributionFactor,
        vrvBaselinePricePerFt: spec.vrvBaselinePricePerFt,
        insulationCostPerFt:   spec.insulationCostPerFt,
      },
      create: {
        nominalSize:           spec.nominalSize,
        sortOrder:             spec.sortOrder,
        weightKLbPerFt:        spec.weightKLbPerFt,
        weightLLbPerFt:        spec.weightLLbPerFt,
        weightMLbPerFt:        spec.weightMLbPerFt,
        distributionFactor:    spec.distributionFactor,
        vrvBaselinePricePerFt: spec.vrvBaselinePricePerFt,
        insulationCostPerFt:   spec.insulationCostPerFt,
      },
    });
    console.log(`  ✓ pipe spec  ${spec.nominalSize.padEnd(8)}  wL=${spec.weightLLbPerFt} lb/ft  df=${spec.distributionFactor}`);
    specCount++;
  }

  // ── 2. Equipment Configs ────────────────────────────────────────────────────
  let cfgCount = 0;
  for (const cfg of EQUIPMENT_CONFIGS) {
    await prisma.copperEquipmentConfig.upsert({
      where:  { equipType_tonnage: { equipType: cfg.equipType, tonnage: cfg.tonnage } },
      update: {
        liquidPipeSize:          cfg.liquidPipeSize,
        suctionPipeSize:         cfg.suctionPipeSize,
        avgLengthShortFt:        cfg.avgLengthShortFt,
        avgLengthLongFt:         cfg.avgLengthLongFt,
        baselineCopperLShort:    cfg.baselineCopperLShort,
        baselineCopperLLong:     cfg.baselineCopperLLong,
        baselineCopperRollShort: cfg.baselineCopperRollShort,
        baselineCopperRollLong:  cfg.baselineCopperRollLong,
        baselineShort:           cfg.baselineShort,
        baselineLong:            cfg.baselineLong,
        vrvBasePerFt:            cfg.vrvBasePerFt,
        vrvBlendedWeightPerFt:   cfg.vrvBlendedWeightPerFt,
        vrvInsulationPerFt:      cfg.vrvInsulationPerFt,
      },
      create: {
        equipType:               cfg.equipType,
        tonnage:                 cfg.tonnage,
        liquidPipeSize:          cfg.liquidPipeSize,
        suctionPipeSize:         cfg.suctionPipeSize,
        avgLengthShortFt:        cfg.avgLengthShortFt,
        avgLengthLongFt:         cfg.avgLengthLongFt,
        baselineCopperLShort:    cfg.baselineCopperLShort,
        baselineCopperLLong:     cfg.baselineCopperLLong,
        baselineCopperRollShort: cfg.baselineCopperRollShort,
        baselineCopperRollLong:  cfg.baselineCopperRollLong,
        baselineShort:           cfg.baselineShort,
        baselineLong:            cfg.baselineLong,
        vrvBasePerFt:            cfg.vrvBasePerFt,
        vrvBlendedWeightPerFt:   cfg.vrvBlendedWeightPerFt,
        vrvInsulationPerFt:      cfg.vrvInsulationPerFt,
      },
    });
    const label = cfg.equipType === 'vrv'
      ? `vrv     ${cfg.tonnage}t  basePerFt=$${cfg.vrvBasePerFt}`
      : `${cfg.equipType.padEnd(12)} ${String(cfg.tonnage).padStart(2)}t  liq=${cfg.liquidPipeSize}  suc=${cfg.suctionPipeSize}`;
    console.log(`  ✓ equip cfg  ${label}`);
    cfgCount++;
  }

  console.log(`\n✅  Done — ${specCount} pipe specs, ${cfgCount} equipment configs upserted.\n`);
}

seed()
  .catch(err => { console.error('\n❌  Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
