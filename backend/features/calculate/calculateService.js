const engine             = require('../../engine/calculationEngine');
const { SYSTEM_TYPES }   = engine;

const MODULE_BATCH_MAP = {
  UNIT_SCHEDULE: {
    [SYSTEM_TYPES.PACKAGED]:   engine.calcPackagedBatch,
    [SYSTEM_TYPES.SPLIT]:      engine.calcSplitBatch,
    [SYSTEM_TYPES.WALL_MOUNT]: engine.calcWallMountBatch,
    [SYSTEM_TYPES.VRF]:        engine.calcVRFBatch,
  },
  FAN_SCHEDULE: { DEFAULT: engine.calcFanBatch },
};

function resolveCalcFn(module,rows){
    const moduleMap = MODULE_BATCH_MAP[module];
    if(!moduleMap){
        const e = new Error(`Unsupported module: ${module}`);
        e.status = 400;
        throw e;
    }
    const calcFn = moduleMap[rows[0].systemType] || moduleMap.DEFAULT;
if (!calcFn) {
  const e = new Error(`No calculator found for systemType: ${rows[0].systemType}`);
  e.status = 400;
  throw e;
}
return calcFn;
}


async function calculate({module,rows,settings}){

    if(!rows?.length){
        const e = new Error('rows is required');
        e.status = 400;
        throw e;
    }
    const calcFn=resolveCalcFn(module,rows);

    const result = calcFn(rows);

    return result;
}

module.exports = {
    calculate,
};