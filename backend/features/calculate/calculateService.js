const engine             = require('../../engine/calculationEngine');
const ductEngine         = require('../../engine/ductCalculationEngine');
const miscEngine         = require('../../engine/miscCalculationEngine');
const { SYSTEM_TYPES }   = engine;

const MODULE_BATCH_MAP = {
  UNIT_SCHEDULE: {
    [SYSTEM_TYPES.PACKAGED]:   engine.calcPackagedBatch,
    [SYSTEM_TYPES.SPLIT]:      engine.calcSplitBatch,
    [SYSTEM_TYPES.WALL_MOUNT]: engine.calcWallMountBatch,
    [SYSTEM_TYPES.VRF]:        engine.calcVRFBatch,
  },
  FAN_SCHEDULE:      { DEFAULT: engine.calcFanBatch },
  METAL_DUCT:        { DEFAULT: (rows, settings) => ductEngine.calcDuctBatch(rows, settings || {}) },
  DIFFUSER_SCHEDULE: { DEFAULT: (rows, settings) => miscEngine.calcDiffuserBatch(rows, settings || {}) },
  ELECTRIC_HEAT:     { DEFAULT: (rows, settings) => miscEngine.calcElectricHeatBatch(rows, settings || {}) },
  GENERAL_ITEMS:     { DEFAULT: (rows, settings) => miscEngine.calcGeneralBatch(rows, settings || {}) },
};

function resolveCalcFn(module, rows) {
  const moduleMap = MODULE_BATCH_MAP[module];
  if (!moduleMap) {
    const e = new Error('Unsupported module: ' + module);
    e.status = 400;
    throw e;
  }
  const systemType = rows[0] && rows[0].systemType;
  const calcFn = (systemType && moduleMap[systemType]) || moduleMap.DEFAULT;
  if (!calcFn) {
    const e = new Error('No calculator found for systemType: ' + systemType);
    e.status = 400;
    throw e;
  }
  return calcFn;
}

async function calculate(args) {
  const module   = args.module;
  const rows     = args.rows;
  const settings = args.settings;

  // GENERAL_ITEMS sends no rows — allow empty array
  const ROWS_OPTIONAL = ['GENERAL_ITEMS'];
  if ((!rows || !rows.length) && ROWS_OPTIONAL.indexOf(module) === -1) {
    const e = new Error('rows is required');
    e.status = 400;
    throw e;
  }
  const safeRows = rows || [];
  const calcFn   = resolveCalcFn(module, safeRows);
  return calcFn(safeRows, settings);
}

module.exports = { calculate };
