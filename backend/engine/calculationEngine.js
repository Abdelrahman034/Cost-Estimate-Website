// ─────────────────────────────────────────────────────────────────────────────
// calculationEngine.js
//
// Single source of truth for ALL HVAC estimation formulas.
// Ported from the Excel workbook ("Unit Sched" sheet).
//
// RULES:
//   1. No Express/Prisma imports here — pure calculation logic only.
//   2. Every function is deterministic: same input always produces same output.
//   3. To change a price table, change it here. Nowhere else.
//   4. Frontend should call the API and receive results — it no longer calculates.
//
// Structure:
//   ① Constants & Tech Rates
//   ② Pricing Tables (material & labor hours by tons/CFM)
//   ③ Lookup Helpers
//   ④ Unit Calculators  (Packaged, Split, Wall Mount, VRF, Service, Fan, Louver/Damper)
//   ⑤ Batch Calculators
//   ⑥ Summary Roll-Up
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ① CONSTANTS & TECH RATES
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_TYPES = {
  PACKAGED:   'Packaged Unit',
  SPLIT:      'Standard Split',
  WALL_MOUNT: 'Wall Mount Split',
  VRF:        'VRF',
  VAV_FBP:    'VAV/FBP',
  CHILLER:    'Chiller',
  BOILER:     'Boiler',
};

// Labor rates $/hr — adjust here or override per estimate via techRate field
// Packaged RTU = sheet-metal crew rate
// Split/Wall-Mount/VRF = HVAC-R certified technician (refrigerant handling)
const TECH_RATE            = 25;  // Packaged / RTU
const SPLIT_TECH_RATE      = 65;  // Standard Split
const WALL_MOUNT_TECH_RATE = 65;  // Wall Mount Split
const VRF_TECH_RATE        = 75;  // VRF specialist
const FAN_TECH_RATE        = 25;  // Fan schedule
const LD_TECH_RATE         = 25;  // Louvers & Dampers

const MISC_CONSUMABLES_PCT = 0.03; // 3% of accessories total

// ─────────────────────────────────────────────────────────────────────────────
// ② PRICING TABLES
// All tables follow the format: [[tons/CFM, value], ...]
// lookupByTons() does an Excel-style FLOOR match against these breakpoints.
// ─────────────────────────────────────────────────────────────────────────────

// ── Service of Existing Units ────────────────────────────────────────────────
// Source: Unit Sched rows 19-22

const SERVICE_PRICING_TABLE = [
  { tons: 0,  material: { packaged: 150, split: 150, wallMount: 97.5,   vrf: 300,  vav: 195,  chiller: 650,  boiler: 300 },
               labor:    { packaged: 100, split: 100, wallMount: 75,     vrf: 400,  vav: 50,   chiller: 400,  boiler: 400 } },
  { tons: 5,  material: { packaged: 150, split: 150, wallMount: 97.5,   vrf: 300,  vav: 195,  chiller: 650,  boiler: 300 },
               labor:    { packaged: 100, split: 100, wallMount: 75,     vrf: 400,  vav: 50,   chiller: 400,  boiler: 400 } },
  { tons: 10, material: { packaged: 175, split: 175, wallMount: 113.75, vrf: 350,  vav: 227.5, chiller: 750,  boiler: 350 },
               labor:    { packaged: 125, split: 125, wallMount: 100,    vrf: 500,  vav: 75,   chiller: 600,  boiler: 450 } },
  { tons: 20, material: { packaged: 175, split: 175, wallMount: 113.75, vrf: 400,  vav: 260,  chiller: 1200, boiler: 400 },
               labor:    { packaged: 200, split: 200, wallMount: 150,    vrf: 800,  vav: 125,  chiller: 800,  boiler: 600 } },
  { tons: 50, material: { packaged: 250, split: 250, wallMount: 162.5,  vrf: 800,  vav: 520,  chiller: 1500, boiler: 600 },
               labor:    { packaged: 400, split: 400, wallMount: 250,    vrf: 1000, vav: 200,  chiller: 1200, boiler: 800 } },
  { tons: 75, material: { packaged: 350, split: 350, wallMount: 227.5,  vrf: 1500, vav: 975,  chiller: 2000, boiler: 800 },
               labor:    { packaged: 800, split: 800, wallMount: 300,    vrf: 1500, vav: 300,  chiller: 1600, boiler: 1200 } },
];

const SYSTEM_TYPE_KEY_MAP = {
  [SYSTEM_TYPES.PACKAGED]:   'packaged',
  [SYSTEM_TYPES.SPLIT]:      'split',
  [SYSTEM_TYPES.WALL_MOUNT]: 'wallMount',
  [SYSTEM_TYPES.VRF]:        'vrf',
  [SYSTEM_TYPES.VAV_FBP]:    'vav',
  [SYSTEM_TYPES.CHILLER]:    'chiller',
  [SYSTEM_TYPES.BOILER]:     'boiler',
};

// ── Packaged Unit (RTU) — Accessory Material Prices ──────────────────────────
// Source: Unit Sched rows 57-63, cols BD-CT

const PKG_ACCESSORY_TABLES = {
  economizer:    [[0,1200],[5,1300],[10,1800],[20,2500],[50,6000],[75,15000]],
  standardCurb:  [[0,450], [5,500], [10,600], [20,1000],[50,6000],[75,15000]],
  metalRoofCurb: [[0,3500],[5,4000],[10,4800],[20,5500],[50,10000],[75,15000]],
  curbAdapter:   [[0,1300],[5,1600],[10,1900],[20,3500],[50,8000], [75,13000]],
  thermostat:    160,   // flat rate $/unit
  statWire:      45,    // flat rate $/unit
  smokeDetector: 170,   // flat rate $/detector
  pvcCond:       86,    // flat rate
  cuCond:        265,   // flat rate
  sensors:       125,   // flat rate $/sensor
  newDrops:      [[0,400],[5,450],[10,500],[20,750],[50,1000],[75,1500]],
  drumLouvers:   [[0,2400],[5,2400],[10,2600],[20,3100],[50,6000],[75,9000]],
};

// Packaged Unit — Labor Hours by Tons
// Source: Unit Sched cols BS-CT
const PKG_LABOR_HOURS = {
  baseUnit:      [[0,4],[5,5],[10,6],[20,7],[50,14],[75,28]],
  standardCurb:  [[0,8],[5,8],[10,9],[20,10],[50,15],[75,30]],
  metalRoofCurb: [[0,11],[5,11],[10,12],[20,14],[50,20],[75,40]],
  curbAdapter:   [[0,3],[5,3],[10,3],[20,4],[50,8],[75,16]],
  economizer:    [[0,5],[5,5],[10,5],[20,6],[50,8],[75,12]],
  pvcCond:       [[0,4],[5,4],[10,4],[20,5],[50,6],[75,8]],
  cuCond:        [[0,12],[5,12],[10,12],[20,14],[50,18],[75,22]],
  thermostat:    [[0,1],[5,1],[10,1],[20,1],[50,2],[75,3]],
  smokeDetector: [[0,2],[5,2],[10,2],[20,2],[50,3],[75,3]],
  sensors:       [[0,2],[5,2],[10,2],[20,2],[50,2],[75,2]],
  statWire:      [[0,3],[5,3],[10,3],[20,3],[50,3],[75,3]],
  startUp:       [[0,4],[5,4],[10,4],[20,5],[50,7],[75,12]],
  newDrops:      [[0,16],[5,16],[10,24],[20,32],[50,48],[75,56]],
  drumLouvers:   [[0,16],[5,16],[10,20],[20,24],[50,32],[75,40]],
};

// ── Standard Split System — Accessory Material Prices ────────────────────────
// Source: Unit Sched rows 86-92, cols BI-DM

const SPLIT_ACCESSORY_TABLES = {
  condenserRails:  [[0,350],[5,350],[10,380],[20,450],[50,1200],[75,4000]],
  drainPan:        [[0,70], [5,80], [10,120],[20,180],[50,600], [75,1500]],
  cuLineUnder100:  [[0,1128],[5,1208],[10,1208],[20,3216],[50,4496],[75,6096]],
  cuLineOver100:   [[0,1692],[5,1812],[10,1812],[20,4824],[50,6744],[75,9144]],
  cuRollUnder100:  [[0,564], [5,604], [10,604], [20,1608],[50,2248],[75,3048]],
  cuRollOver100:   [[0,846], [5,906], [10,906], [20,2412],[50,3372],[75,4572]],
  oaDamper:        [[0,180],[5,225],[10,260],[20,400],[50,800],[75,1600]],
  ductTransitions: [[0,200],[5,200],[10,300],[20,400],[50,800],[75,1600]],
  floatSwitch:     16,
  pvcCond:         129,
  cuCond:          265,
  thermostat:      160,
  statWire:        45,
  smokeDetector:   170,
  sensors:         125,
};

// Split System — Labor Hours by Tons
const SPLIT_LABOR_HOURS = {
  baseUnit:        [[0,24],[5,24],[10,32],[20,40],[50,60],[75,120]],
  condenserRails:  [[0,6], [5,6], [10,8], [20,16],[50,30],[75,60]],
  drainPan:        [[0,4], [5,4], [10,5], [20,6], [50,9], [75,14]],
  cuLineUnder100:  [[0,24],[5,24],[10,30],[20,42],[50,60],[75,120]],
  cuLineOver100:   [[0,36],[5,36],[10,45],[20,63],[50,90],[75,180]],
  cuRollUnder100:  [[0,8], [5,8], [10,10],[20,14],[50,20],[75,40]],
  cuRollOver100:   [[0,12],[5,12],[10,15],[20,21],[50,30],[75,60]],
  oaDamper:        [[0,6], [5,6], [10,6], [20,8], [50,12],[75,16]],
  floatSwitch:     [[0,1], [5,1], [10,1], [20,1], [50,1], [75,1]],
  pvcCond:         [[0,5], [5,5], [10,5], [20,6], [50,7], [75,9]],
  cuCond:          [[0,14],[5,14],[10,14],[20,16],[50,20],[75,24]],
  thermostat:      [[0,2], [5,2], [10,2], [20,2], [50,3], [75,4]],
  smokeDetector:   [[0,3], [5,3], [10,3], [20,3], [50,4], [75,4]],
  sensors:         [[0,2], [5,2], [10,2], [20,2], [50,2], [75,2]],
  statWire:        [[0,3], [5,3], [10,3], [20,3], [50,3], [75,3]],
  startUp:         [[0,6], [5,6], [10,6], [20,7], [50,9], [75,14]],
  ductTransitions: [[0,4], [5,4], [10,6], [20,8], [50,12],[75,16]],
};

// ── Wall Mount Split — Accessory Material Prices ──────────────────────────────
// Source: Unit Sched rows 115-140, cols AP-BV

const WALL_MOUNT_ACCESSORY_TABLES = {
  condenserRails: [[0,350],[5,350],[10,380],[20,450],[50,1200],[75,4000]],
  condPump:       [[0,150],[5,150],[10,180],[20,250],[50,600], [75,1200]],
  cuUnder100:     [[0,450],[5,450],[10,600],[20,900],[50,2000],[75,4500]],
  cuOver100:      [[0,600],[5,600],[10,800],[20,1300],[50,3000],[75,6000]],
  pvcCond:        86,
  cuCond:         265,
  thermostat:     160,
  statWire:       45,
};

// Wall Mount — Labor Hours by Tons
const WALL_MOUNT_LABOR_HOURS = {
  baseUnit:       [[0,16],[5,16],[10,20],[20,28],[50,48],[75,96]],
  condenserRails: [[0,4], [5,4], [10,6], [20,10],[50,20],[75,40]],
  condPump:       [[0,3], [5,3], [10,4], [20,6], [50,12],[75,20]],
  cuUnder100:     [[0,8], [5,8], [10,12],[20,18],[50,30],[75,60]],
  cuOver100:      [[0,12],[5,12],[10,18],[20,27],[50,45],[75,90]],
  pvcCond:        [[0,3], [5,3], [10,3], [20,4], [50,5], [75,7]],
  cuCond:         [[0,8], [5,8], [10,10],[20,12],[50,16],[75,20]],
  thermostat:     [[0,1], [5,1], [10,1], [20,1], [50,2], [75,3]],
  statWire:       [[0,2], [5,2], [10,2], [20,2], [50,2], [75,2]],
  startUp:        [[0,3], [5,3], [10,4], [20,5], [50,8], [75,14]],
};

// ── VRF System — Accessory Material Prices ────────────────────────────────────
// Source: Unit Sched rows 143-169, cols AW-CB

const VRF_ACCESSORY_TABLES = {
  condenserRails:     [[0,400],[5,400],[10,500],[20,700],[50,1500],[75,5000]],
  drainPan:           [[0,100],[5,100],[10,130],[20,200],[50,700], [75,1600]],
  cuLineRatePerFt:    [[0,18],[5,18],[10,20],[20,25],[50,35],[75,45]], // $/ft
  refrigChargePerTon: 45, // flat $/ton
  pvcCond:            86,
  cuCond:             265,
  thermostat:         160,
  smokeDetector:      170,
  sensors:            125,
  statWire:           45,
};

// VRF System — Labor Hours
const VRF_LABOR_HOURS = {
  baseUnit:      [[0,6],[5,6],[10,8],[20,10],[50,18],[75,36]],   // per indoor unit
  condenserUnit: [[0,8],[5,8],[10,10],[20,14],[50,24],[75,48]],  // per outdoor CU
  condenserRails:[[0,5],[5,5],[10,7],[20,10],[50,20],[75,40]],
  drainPan:      [[0,3],[5,3],[10,4],[20,5],[50,8],[75,14]],
  cuLine:        [[0,10],[5,10],[10,12],[20,16],[50,24],[75,40]],
  pvcCond:       [[0,3],[5,3],[10,3],[20,4],[50,5],[75,7]],
  cuCond:        [[0,8],[5,8],[10,10],[20,12],[50,16],[75,20]],
  thermostat:    [[0,1],[5,1],[10,1],[20,1],[50,2],[75,3]],
  smokeDetector: [[0,2],[5,2],[10,2],[20,2],[50,3],[75,3]],
  sensors:       [[0,2],[5,2],[10,2],[20,2],[50,2],[75,2]],
  statWire:      [[0,3],[5,3],[10,3],[20,3],[50,3],[75,3]],
  startUp:       [[0,5],[5,5],[10,6],[20,8],[50,14],[75,28]],
};

// ── Fan Schedule — Pricing Tables (indexed by CFM) ───────────────────────────
// Source: Fan Schedule sheet

const FAN_BASE_PRICE_TABLE = [
  [0,350],[200,480],[500,720],[1000,1050],[2000,1620],[3000,2450],[5000,3900],[10000,6800],
];

const FAN_ACCESSORY_TABLES = {
  disconnectSwitch: 95,
  gfiOutlet:        75,
  backdraftDamper: [[0,90],[200,125],[500,185],[1000,270],[2000,420],[5000,750],[10000,1200]],
  curb:            [[0,265],[200,330],[500,440],[1000,670],[2000,1020],[5000,1850],[10000,3200]],
  flexConnection:   65,
  vfd:             [[0,370],[200,490],[500,740],[1000,1120],[2000,1850],[5000,3300],[10000,5800]],
  birdScreen:      [[0,50],[200,75],[500,115],[1000,185],[2000,300],[5000,540],[10000,940]],
  wiring:          [[0,140],[200,170],[500,210],[1000,260],[2000,330],[5000,500],[10000,750]],
};

const FAN_LABOR_HOURS = {
  baseInstall:     [[0,3.5],[200,4.5],[500,5.5],[1000,7.5],[2000,11],[3000,15],[5000,20],[10000,30]],
  disconnectSwitch: 1.5,
  gfiOutlet:        1.0,
  backdraftDamper: [[0,1],[200,1.5],[500,2],[1000,2.5],[2000,3.5],[5000,5],[10000,7]],
  curb:            [[0,2],[200,2.5],[500,3.5],[1000,4.5],[2000,6],[5000,8],[10000,12]],
  flexConnection:   0.75,
  vfd:             [[0,3],[200,4],[500,5],[1000,6.5],[2000,9],[5000,13],[10000,18]],
  birdScreen:      [[0,0.5],[200,0.75],[500,1],[1000,1.5],[2000,2.5],[5000,4],[10000,6]],
  wiring:          [[0,2],[200,2.5],[500,3],[1000,4],[2000,5.5],[5000,8],[10000,12]],
  startUp:         [[0,1],[200,1],[500,1.5],[1000,2],[2000,2.5],[5000,3.5],[10000,5]],
};

// ── Louvers & Dampers — Pricing ───────────────────────────────────────────────
// Source: Louvers & FD sheet — pricing per sq ft of face area
// Face area = (widthIn / 12) × (heightIn / 12)

const LOUVER_DAMPER_PRICING = {
  'OA Louver':        { matPerSqFt: 15,  laborHrsPerSqFt: 0.60 },
  'Supply Louver':    { matPerSqFt: 13,  laborHrsPerSqFt: 0.50 },
  'Return Louver':    { matPerSqFt: 13,  laborHrsPerSqFt: 0.50 },
  'Relief Louver':    { matPerSqFt: 11,  laborHrsPerSqFt: 0.40 },
  'Fixed Louver':     { matPerSqFt: 10,  laborHrsPerSqFt: 0.40 },
  'Fire Damper':      { matPerSqFt: 22,  laborHrsPerSqFt: 1.50 },
  'Smoke Damper':     { matPerSqFt: 34,  laborHrsPerSqFt: 2.00 },
  'Combination FSD':  { matPerSqFt: 44,  laborHrsPerSqFt: 2.50 },
  'Volume Damper':    { matPerSqFt: 9,   laborHrsPerSqFt: 0.80 },
  'Backdraft Damper': { matPerSqFt: 8,   laborHrsPerSqFt: 0.60 },
};

const LD_ACCESSORIES = {
  screen:   { perSqFt: 4.5, hoursPerSqFt: 0.15, minMat: 35 },
  actuator: { flat: 285,    flatHours: 2.0 },
  sleeve:   { perSqFt: 6.5, hoursPerSqFt: 0.20, minMat: 45 },
};

const LD_MIN_MAT = 65;
const LD_MIN_HRS = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// ③ LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Excel-style FLOOR match on a [[breakpoint, value]] table.
 * Returns the value at the largest breakpoint that is ≤ the lookup value.
 * Mirrors Excel: INDEX(table, MATCH(tons, sizeCol, 1))
 *
 * This is a STEP function — it does NOT interpolate between breakpoints.
 */
function lookupByTons(table, tons) {
  if (!Array.isArray(table)) return table; // flat rate — return as-is
  const t = Number(tons) || 0;
  const sorted = [...table].sort((a, b) => a[0] - b[0]);
  if (t <= sorted[0][0]) return sorted[0][1];
  if (t >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  let result = sorted[0][1];
  for (let i = 0; i < sorted.length; i++) {
    if (t >= sorted[i][0]) { result = sorted[i][1]; } else { break; }
  }
  return result;
}

function round2(n) { return Math.round(n * 100) / 100; }
function round0(n) { return Math.round(n); }

// ─────────────────────────────────────────────────────────────────────────────
// ④ UNIT CALCULATORS
// ─────────────────────────────────────────────────────────────────────────────

// Selection values:
//   "x"  = we supply & install (material + labor)
//   "xx" = owner/GC supplies, we install only (labor only, no material)
//   ""   = not included

// ── Service of Existing Unit ─────────────────────────────────────────────────

function calcServiceUnit(unit) {
  const { systemType = '', coolTons = 0, pmMaterials = 0, pmLabor = 0 } = unit;
  const typeKey = SYSTEM_TYPE_KEY_MAP[systemType] || 'packaged';
  const tonNum  = Number(coolTons) || 0;

  let matCost = 0, laborCost = 0;
  for (let i = SERVICE_PRICING_TABLE.length - 1; i >= 0; i--) {
    if (tonNum >= SERVICE_PRICING_TABLE[i].tons) {
      matCost   = SERVICE_PRICING_TABLE[i].material[typeKey] || 0;
      laborCost = SERVICE_PRICING_TABLE[i].labor[typeKey]    || 0;
      break;
    }
  }

  const totalMaterial = round2(matCost + Number(pmMaterials));
  const totalLabor    = round2(laborCost + Number(pmLabor));
  return {
    ...unit,
    serviceMaterialCost: round2(matCost),
    serviceLaborCost:    round2(laborCost),
    pmMaterials:         round2(Number(pmMaterials)),
    pmLabor:             round2(Number(pmLabor)),
    totalMaterial,
    totalLabor,
    totalCost: round2(totalMaterial + totalLabor),
  };
}

// ── Packaged RTU ──────────────────────────────────────────────────────────────

function calcPackagedUnit(unit) {
  const {
    coolTons = 0, ownerProvided = '', baseCostPerTon = 0,
    quotedEquipCost = null, accessories = {}, priceOverrides = {},
  } = unit;

  const tons = Number(coolTons) || 0;
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0, accLabor = 0, accHours = 0;
  const TR = TECH_RATE; // packaged always uses sheet-metal rate

  const resolveMat = (key, defaultTable) => {
    if (priceOverrides[key] != null && priceOverrides[key] !== '') return Number(priceOverrides[key]);
    return Array.isArray(defaultTable) ? lookupByTons(defaultTable, tons) : (Number(defaultTable) || 0);
  };

  const addAcc = (sel, matTable, hoursTable, key = null) => {
    if (!sel || sel === '') return;
    const mat = key ? resolveMat(key, matTable) : (Array.isArray(matTable) ? lookupByTons(matTable, tons) : (Number(matTable) || 0));
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, tons) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TR);
    accHours    += round2(hrs);
  };

  const T = PKG_ACCESSORY_TABLES;
  const L = PKG_LABOR_HOURS;

  addAcc(accessories.standardCurb,  T.standardCurb,  L.standardCurb,  'standardCurb');
  addAcc(accessories.metalRoofCurb, T.metalRoofCurb, L.metalRoofCurb, 'metalRoofCurb');
  addAcc(accessories.curbAdapter,   T.curbAdapter,   L.curbAdapter,   'curbAdapter');
  addAcc(accessories.economizer,    T.economizer,    L.economizer,    'economizer');
  addAcc(accessories.pvcCond,       T.pvcCond,       L.pvcCond,       'pvcCond');
  addAcc(accessories.cuCond,        T.cuCond,        L.cuCond,        'cuCond');
  addAcc(accessories.thermostat,    T.thermostat,    L.thermostat,    'thermostat');
  addAcc(accessories.newDrops,      T.newDrops,      L.newDrops,      'newDrops');
  addAcc(accessories.drumLouvers,   T.drumLouvers,   L.drumLouvers,   'drumLouvers');

  if (accessories.smokeDetectors && accessories.smokeDetectors !== '') {
    const qty       = accessories.smokeDetectors === 'xx' ? 0 : (Number(accessories.smokeDetectors) || 1);
    const unitPrice = resolveMat('smokeDetector', T.smokeDetector);
    accMaterial += accessories.smokeDetectors === 'xx' ? 0 : round2(unitPrice * qty);
    const hrs    = round2(lookupByTons(L.smokeDetector, tons) * (Number(accessories.smokeDetectors) || 1));
    accLabor    += round2(hrs * TR);
    accHours    += hrs;
  }
  if (accessories.sensorQty && Number(accessories.sensorQty) > 0) {
    const qty       = Number(accessories.sensorQty);
    const unitPrice = resolveMat('sensors', T.sensors);
    accMaterial += round2(unitPrice * qty);
    accLabor    += round2(lookupByTons(L.sensors, tons) * qty * TR);
    accHours    += round2(lookupByTons(L.sensors, tons) * qty);
  }
  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat;
    accLabor    += round2(statHrs * TR);
    accHours    += statHrs;
  }

  const baseHours  = lookupByTons(L.baseUnit, tons);
  const startHours = lookupByTons(L.startUp, tons);
  accLabor  += round2((baseHours + startHours) * TR);
  accHours  += baseHours + startHours;

  const misc      = round2(accMaterial * MISC_CONSUMABLES_PCT);
  const totalMat  = round2(equipCost + accMaterial + misc);
  const totalLabor = round2(accLabor);

  return {
    ...unit, estEquipCost, equipCost,
    accMaterial: round2(accMaterial), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: round2(accHours), totalCost: round2(totalMat + totalLabor),
  };
}

// ── Standard Split ────────────────────────────────────────────────────────────

function calcSplitUnit(unit) {
  const {
    coolTons = 0, ownerProvided = '', baseCostPerTon = 0,
    quotedEquipCost = null, accessories = {},
    techRate = SPLIT_TECH_RATE, priceOverrides = {},
  } = unit;

  const tons = Number(coolTons) || 0;
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0, accLabor = 0, accHours = 0;
  const TR = Number(techRate) || SPLIT_TECH_RATE;
  const T  = SPLIT_ACCESSORY_TABLES;
  const L  = SPLIT_LABOR_HOURS;

  const resolveMat = (key, defaultTable) => {
    if (priceOverrides[key] != null && priceOverrides[key] !== '') return Number(priceOverrides[key]);
    return Array.isArray(defaultTable) ? lookupByTons(defaultTable, tons) : (Number(defaultTable) || 0);
  };

  const addAcc = (sel, matTable, hoursTable, key = null) => {
    if (!sel || sel === '') return;
    const mat = key ? resolveMat(key, matTable) : (Array.isArray(matTable) ? lookupByTons(matTable, tons) : (Number(matTable) || 0));
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, tons) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TR);
    accHours    += round2(hrs);
  };

  addAcc(accessories.condenserRails,  T.condenserRails,  L.condenserRails,  'condenserRails');
  addAcc(accessories.drainPan,        T.drainPan,        L.drainPan,        'drainPan');
  addAcc(accessories.cuLineUnder100,  T.cuLineUnder100,  L.cuLineUnder100,  'cuLineUnder100');
  addAcc(accessories.cuLineOver100,   T.cuLineOver100,   L.cuLineOver100,   'cuLineOver100');
  addAcc(accessories.cuRollUnder100,  T.cuRollUnder100,  L.cuRollUnder100,  'cuRollUnder100');
  addAcc(accessories.cuRollOver100,   T.cuRollOver100,   L.cuRollOver100,   'cuRollOver100');
  addAcc(accessories.oaDamper,        T.oaDamper,        L.oaDamper,        'oaDamper');
  addAcc(accessories.floatSwitch,     T.floatSwitch,     L.floatSwitch,     'floatSwitch');
  addAcc(accessories.pvcCond,         T.pvcCond,         L.pvcCond,         'pvcCond');
  addAcc(accessories.cuCond,          T.cuCond,          L.cuCond,          'cuCond');
  addAcc(accessories.thermostat,      T.thermostat,      L.thermostat,      'thermostat');
  addAcc(accessories.ductTransitions, T.ductTransitions, L.ductTransitions, 'ductTransitions');

  if (accessories.smokeDetectors && accessories.smokeDetectors !== '') {
    const mat = accessories.smokeDetectors === 'xx' ? 0 : resolveMat('smokeDetector', T.smokeDetector);
    const hrs = lookupByTons(L.smokeDetector, tons);
    accMaterial += mat; accLabor += round2(hrs * TR); accHours += hrs;
  }
  if (accessories.sensorQty && Number(accessories.sensorQty) > 0) {
    const qty = Number(accessories.sensorQty);
    accMaterial += round2(resolveMat('sensors', T.sensors) * qty);
    accLabor    += round2(lookupByTons(L.sensors, tons) * qty * TR);
    accHours    += round2(lookupByTons(L.sensors, tons) * qty);
  }
  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat; accLabor += round2(statHrs * TR); accHours += statHrs;
  }

  const baseHours  = lookupByTons(L.baseUnit, tons);
  const startHours = lookupByTons(L.startUp, tons);
  accLabor  += round2((baseHours + startHours) * TR);
  accHours  += baseHours + startHours;

  const misc      = round2(accMaterial * MISC_CONSUMABLES_PCT);
  const totalMat  = round2(equipCost + accMaterial + misc);
  const totalLabor = round2(accLabor);

  return {
    ...unit, estEquipCost, equipCost,
    accMaterial: round2(accMaterial), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: round2(accHours), totalCost: round2(totalMat + totalLabor),
  };
}

// ── Wall Mount Split ──────────────────────────────────────────────────────────

function calcWallMountUnit(unit) {
  const {
    coolTons = 0, ownerProvided = '', baseCostPerTon = 0,
    quotedEquipCost = null, accessories = {},
    techRate = WALL_MOUNT_TECH_RATE, priceOverrides = {},
  } = unit;

  const tons = Number(coolTons) || 0;
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0, accLabor = 0, accHours = 0;
  const TR = Number(techRate) || WALL_MOUNT_TECH_RATE;
  const T  = WALL_MOUNT_ACCESSORY_TABLES;
  const L  = WALL_MOUNT_LABOR_HOURS;

  const resolveMat = (key, defaultTable) => {
    if (priceOverrides[key] != null && priceOverrides[key] !== '') return Number(priceOverrides[key]);
    return Array.isArray(defaultTable) ? lookupByTons(defaultTable, tons) : (Number(defaultTable) || 0);
  };

  const addAcc = (sel, matTable, hoursTable, key = null) => {
    if (!sel || sel === '') return;
    const mat = key ? resolveMat(key, matTable) : (Array.isArray(matTable) ? lookupByTons(matTable, tons) : (Number(matTable) || 0));
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, tons) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TR);
    accHours    += round2(hrs);
  };

  addAcc(accessories.condenserRails, T.condenserRails, L.condenserRails, 'condenserRails');
  addAcc(accessories.condPump,       T.condPump,       L.condPump,       'condPump');
  addAcc(accessories.cuUnder100,     T.cuUnder100,     L.cuUnder100,     'cuUnder100');
  addAcc(accessories.cuOver100,      T.cuOver100,      L.cuOver100,      'cuOver100');
  addAcc(accessories.pvcCond,        T.pvcCond,        L.pvcCond,        'pvcCond');
  addAcc(accessories.cuCond,         T.cuCond,         L.cuCond,         'cuCond');
  addAcc(accessories.thermostat,     T.thermostat,     L.thermostat,     'thermostat');

  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat; accLabor += round2(statHrs * TR); accHours += statHrs;
  }

  const baseHours  = lookupByTons(L.baseUnit, tons);
  const startHours = lookupByTons(L.startUp, tons);
  accLabor  += round2((baseHours + startHours) * TR);
  accHours  += baseHours + startHours;

  const misc      = round2(accMaterial * MISC_CONSUMABLES_PCT);
  const totalMat  = round2(equipCost + accMaterial + misc);
  const totalLabor = round2(accLabor);

  return {
    ...unit, estEquipCost, equipCost,
    accMaterial: round2(accMaterial), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: round2(accHours), totalCost: round2(totalMat + totalLabor),
  };
}

// ── VRF System ────────────────────────────────────────────────────────────────

function calcVRFUnit(unit) {
  const {
    coolTons = 0, condensingUnits = 1, indoorUnits = 1,
    indoorCoolAvgTons = 0, ownerProvided = '', baseCostPerTon = 0,
    quotedEquipCost = null, cuLineAvgLength = 0,
    accessories = {}, techRate = VRF_TECH_RATE, priceOverrides = {},
  } = unit;

  const tons      = Number(coolTons) || 0;
  const indoorAvg = Number(indoorCoolAvgTons) || (tons / Math.max(1, Number(indoorUnits)));
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0, accLabor = 0, accHours = 0;
  const TR = Number(techRate) || VRF_TECH_RATE;
  const T  = VRF_ACCESSORY_TABLES;
  const L  = VRF_LABOR_HOURS;

  const resolveMat = (key, defaultTable) => {
    if (priceOverrides[key] != null && priceOverrides[key] !== '') return Number(priceOverrides[key]);
    return Array.isArray(defaultTable) ? lookupByTons(defaultTable, tons) : (Number(defaultTable) || 0);
  };

  const addAcc = (sel, matTable, hoursTable, key = null) => {
    if (!sel || sel === '') return;
    const mat = key ? resolveMat(key, matTable) : (Array.isArray(matTable) ? lookupByTons(matTable, tons) : (Number(matTable) || 0));
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, tons) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TR);
    accHours    += round2(hrs);
  };

  addAcc(accessories.condenserRails, T.condenserRails, L.condenserRails, 'condenserRails');
  addAcc(accessories.drainPan,       T.drainPan,       L.drainPan,       'drainPan');
  addAcc(accessories.pvcCond,        T.pvcCond,        L.pvcCond,        'pvcCond');
  addAcc(accessories.cuCond,         T.cuCond,         L.cuCond,         'cuCond');
  addAcc(accessories.thermostat,     T.thermostat,     L.thermostat,     'thermostat');
  addAcc(accessories.smokeDetectors, T.smokeDetector,  L.smokeDetector,  'smokeDetector');

  if (accessories.cuLine && accessories.cuLine !== '' && Number(cuLineAvgLength) > 0) {
    const ratePerFt = (priceOverrides.cuLineRatePerFt != null && priceOverrides.cuLineRatePerFt !== '')
      ? Number(priceOverrides.cuLineRatePerFt)
      : lookupByTons(T.cuLineRatePerFt, indoorAvg);
    const lineMat = accessories.cuLine === 'xx' ? 0 : round2(ratePerFt * Number(cuLineAvgLength) * Number(indoorUnits));
    const lineHrs = round2(lookupByTons(L.cuLine, tons));
    accMaterial += lineMat; accLabor += round2(lineHrs * TR); accHours += lineHrs;
  }
  if (accessories.refrigCharge && accessories.refrigCharge !== '') {
    const baseRate = (priceOverrides.refrigChargePerTon != null && priceOverrides.refrigChargePerTon !== '')
      ? Number(priceOverrides.refrigChargePerTon)
      : T.refrigChargePerTon;
    accMaterial += accessories.refrigCharge === 'xx' ? 0 : round2(baseRate * indoorAvg * Number(indoorUnits));
  }
  if (accessories.sensorQty && Number(accessories.sensorQty) > 0) {
    const qty = Number(accessories.sensorQty);
    accMaterial += round2(resolveMat('sensors', T.sensors) * qty);
    accLabor    += round2(lookupByTons(L.sensors, tons) * qty * TR);
    accHours    += round2(lookupByTons(L.sensors, tons) * qty);
  }
  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat; accLabor += round2(statHrs * TR); accHours += statHrs;
  }

  const indHrs   = round2(lookupByTons(L.baseUnit, indoorAvg) * Number(indoorUnits));
  const cuHrs    = round2(lookupByTons(L.condenserUnit, tons) * Number(condensingUnits));
  const startHrs = lookupByTons(L.startUp, tons);
  accLabor  += round2((indHrs + cuHrs + startHrs) * TR);
  accHours  += indHrs + cuHrs + startHrs;

  const misc      = round2(accMaterial * MISC_CONSUMABLES_PCT);
  const totalMat  = round2(equipCost + accMaterial + misc);
  const totalLabor = round2(accLabor);

  return {
    ...unit, estEquipCost, equipCost,
    accMaterial: round2(accMaterial), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: round2(accHours), totalCost: round2(totalMat + totalLabor),
  };
}

// ── Fan ───────────────────────────────────────────────────────────────────────

function calcFanUnit(unit) {
  const {
    cfm = 0, ownerProvided = '', unitPrice = 0,
    quotedEquipCost = null, accessories = {},
  } = unit;

  const c = Number(cfm) || 0;
  const estEquipCost = round0(Number(unitPrice) > 0 ? Number(unitPrice) : lookupByTons(FAN_BASE_PRICE_TABLE, c));
  const equipCost = ownerProvided === 'xx' ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0, accLabor = 0, accHours = 0;

  const addAcc = (sel, matTable, hoursTable) => {
    if (!sel || sel === '') return;
    const mat = Array.isArray(matTable) ? lookupByTons(matTable, c) : (Number(matTable) || 0);
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, c) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * FAN_TECH_RATE);
    accHours    += round2(hrs);
  };

  const T = FAN_ACCESSORY_TABLES;
  const L = FAN_LABOR_HOURS;

  addAcc(accessories.disconnectSwitch, T.disconnectSwitch, L.disconnectSwitch);
  addAcc(accessories.gfiOutlet,        T.gfiOutlet,        L.gfiOutlet);
  addAcc(accessories.backdraftDamper,  T.backdraftDamper,  L.backdraftDamper);
  addAcc(accessories.curb,             T.curb,             L.curb);
  addAcc(accessories.flexConnection,   T.flexConnection,   L.flexConnection);
  addAcc(accessories.vfd,              T.vfd,              L.vfd);
  addAcc(accessories.birdScreen,       T.birdScreen,       L.birdScreen);
  addAcc(accessories.wiring,           T.wiring,           L.wiring);

  const baseHrs  = lookupByTons(L.baseInstall, c);
  const startHrs = lookupByTons(L.startUp, c);
  accLabor  += round2((baseHrs + startHrs) * FAN_TECH_RATE);
  accHours  += baseHrs + startHrs;

  const misc      = round2(accMaterial * MISC_CONSUMABLES_PCT);
  const totalMat  = round2(equipCost + accMaterial + misc);
  const totalLabor = round2(accLabor);

  return {
    ...unit, estEquipCost, equipCost,
    accMaterial: round2(accMaterial), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: round2(accHours), totalCost: round2(totalMat + totalLabor),
  };
}

// ── Louvers & Dampers ─────────────────────────────────────────────────────────

function calcLouverDamperUnit(unit) {
  const {
    type = 'OA Louver', widthIn = 0, heightIn = 0,
    qty = 1, ownerProvided = '', unitPrice = 0, accessories = {},
  } = unit;

  const w = Number(widthIn) || 0;
  const h = Number(heightIn) || 0;
  const q = Math.max(1, Number(qty));
  const faceArea = round2((w / 12) * (h / 12));

  const pricing  = LOUVER_DAMPER_PRICING[type] || LOUVER_DAMPER_PRICING['OA Louver'];
  const baseMat  = Math.max(LD_MIN_MAT, faceArea * pricing.matPerSqFt);
  const baseHrs  = Math.max(LD_MIN_HRS, faceArea * pricing.laborHrsPerSqFt);
  const unitMat  = ownerProvided === 'xx' ? 0
    : (Number(unitPrice) > 0 ? Number(unitPrice) : baseMat);

  let accMatPerUnit = 0, accHrsPerUnit = 0;

  if (accessories.screen && accessories.screen !== '') {
    accMatPerUnit += accessories.screen === 'xx' ? 0 : Math.max(LD_ACCESSORIES.screen.minMat, faceArea * LD_ACCESSORIES.screen.perSqFt);
    accHrsPerUnit += faceArea * LD_ACCESSORIES.screen.hoursPerSqFt + 0.25;
  }
  if (accessories.actuator && accessories.actuator !== '') {
    accMatPerUnit += accessories.actuator === 'xx' ? 0 : LD_ACCESSORIES.actuator.flat;
    accHrsPerUnit += LD_ACCESSORIES.actuator.flatHours;
  }
  if (accessories.sleeve && accessories.sleeve !== '') {
    accMatPerUnit += accessories.sleeve === 'xx' ? 0 : Math.max(LD_ACCESSORIES.sleeve.minMat, faceArea * LD_ACCESSORIES.sleeve.perSqFt);
    accHrsPerUnit += faceArea * LD_ACCESSORIES.sleeve.hoursPerSqFt + 0.25;
  }

  const totalUnitMat = round2((unitMat + accMatPerUnit) * q);
  const totalHrs     = round2((baseHrs + accHrsPerUnit) * q);
  const totalLabor   = round2(totalHrs * LD_TECH_RATE);
  const misc         = round2(totalUnitMat * MISC_CONSUMABLES_PCT);
  const totalMat     = round2(totalUnitMat + misc);

  return {
    ...unit, faceArea,
    baseMat: round2(baseMat), unitMat: round2(unitMat),
    accMaterial: round2(accMatPerUnit * q), miscCost: misc,
    totalMaterial: totalMat, totalLabor,
    totalHours: totalHrs, totalCost: round2(totalMat + totalLabor),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ BATCH CALCULATORS
// Accepts an array of row objects, returns { rows, totals }
// ─────────────────────────────────────────────────────────────────────────────

function batchCalc(rows, calcFn) {
  const results = rows.map((r, i) => ({ id: r.id || `row-${i}`, ...calcFn(r) }));
  const totals  = results.reduce(
    (acc, r) => ({
      coolTons:      acc.coolTons      + (Number(r.coolTons) || 0),
      totalMaterial: acc.totalMaterial + (r.totalMaterial    || 0),
      totalLabor:    acc.totalLabor    + (r.totalLabor       || 0),
      totalHours:    acc.totalHours    + (r.totalHours       || 0),
      totalCost:     acc.totalCost     + (r.totalCost        || 0),
    }),
    { coolTons: 0, totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0 }
  );
  Object.keys(totals).forEach(k => { totals[k] = round2(totals[k]); });
  return { rows: results, totals };
}

const calcServiceBatch    = (rows) => batchCalc(rows, calcServiceUnit);
const calcPackagedBatch   = (rows) => batchCalc(rows, calcPackagedUnit);
const calcSplitBatch      = (rows) => batchCalc(rows, calcSplitUnit);
const calcWallMountBatch  = (rows) => batchCalc(rows, calcWallMountUnit);
const calcVRFBatch        = (rows) => batchCalc(rows, calcVRFUnit);
const calcFanBatch        = (rows) => batchCalc(rows, calcFanUnit);
const calcLouverDamperBatch = (rows) => batchCalc(rows, calcLouverDamperUnit);

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ GRAND SUMMARY ROLL-UP
// Mirrors Summary sheet roll-up logic
// ─────────────────────────────────────────────────────────────────────────────

function rollUpUnitSummary({ serviceTotals, packagedTotals, splitTotals, wallMountTotals, vrfTotals, fanTotals, louverDamperTotals }) {
  const sections = [
    { type: SYSTEM_TYPES.PACKAGED,   ...packagedTotals       },
    { type: SYSTEM_TYPES.SPLIT,      ...splitTotals          },
    { type: SYSTEM_TYPES.WALL_MOUNT, ...wallMountTotals      },
    { type: SYSTEM_TYPES.VRF,        ...vrfTotals            },
    { type: 'Service of Existing',   ...serviceTotals        },
    { type: 'Fans',                  ...fanTotals            },
    { type: 'Louvers & Dampers',     ...louverDamperTotals   },
  ];
  const grand = sections.reduce(
    (acc, s) => ({
      totalMaterial: acc.totalMaterial + (s.totalMaterial || 0),
      totalLabor:    acc.totalLabor    + (s.totalLabor    || 0),
      totalCost:     acc.totalCost     + (s.totalCost     || 0),
    }),
    { totalMaterial: 0, totalLabor: 0, totalCost: 0 }
  );
  return {
    sections,
    grand: {
      totalMaterial: round2(grand.totalMaterial),
      totalLabor:    round2(grand.totalLabor),
      totalCost:     round2(grand.totalCost),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  SYSTEM_TYPES, TECH_RATE, SPLIT_TECH_RATE, WALL_MOUNT_TECH_RATE, VRF_TECH_RATE,
  FAN_TECH_RATE, LD_TECH_RATE, MISC_CONSUMABLES_PCT,
  // Tables (exposed so pricing routes can serve them to the frontend)
  PKG_ACCESSORY_TABLES, PKG_LABOR_HOURS,
  SPLIT_ACCESSORY_TABLES, SPLIT_LABOR_HOURS,
  WALL_MOUNT_ACCESSORY_TABLES, WALL_MOUNT_LABOR_HOURS,
  VRF_ACCESSORY_TABLES, VRF_LABOR_HOURS,
  FAN_BASE_PRICE_TABLE, FAN_ACCESSORY_TABLES, FAN_LABOR_HOURS,
  LOUVER_DAMPER_PRICING, LD_ACCESSORIES,
  SERVICE_PRICING_TABLE,
  // Helpers
  lookupByTons,
  // Unit calculators
  calcServiceUnit, calcPackagedUnit, calcSplitUnit,
  calcWallMountUnit, calcVRFUnit, calcFanUnit, calcLouverDamperUnit,
  // Batch calculators
  calcServiceBatch, calcPackagedBatch, calcSplitBatch,
  calcWallMountBatch, calcVRFBatch, calcFanBatch, calcLouverDamperBatch,
  // Summary
  rollUpUnitSummary,
};
