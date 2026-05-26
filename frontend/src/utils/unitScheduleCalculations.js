/**
 * Unit Schedule Calculation Engine
 * Ported from Excel workbook — "Unit Sched" sheet
 *
 * Architecture note (future backend migration):
 *   Every pricing table here maps 1-to-1 to a database table.
 *   Every lookup function maps 1-to-1 to a SQL SELECT with interpolation.
 *   When the Spring Boot API is ready, replace the table constants with
 *   API calls (see API_TODO comments) and keep the interpolation helpers.
 *
 * Database entity equivalents:
 *   SERVICE_MATERIAL_TABLE  → unit_service_material_pricing
 *   SERVICE_LABOR_TABLE     → unit_service_labor_pricing
 *   PACKAGED_ACCESSORY_*    → packaged_unit_accessory_pricing
 *   SPLIT_ACCESSORY_*       → split_unit_accessory_pricing
 *   WALL_MOUNT_ACCESSORY_*  → wall_mount_accessory_pricing
 *   VRF_ACCESSORY_*         → vrf_accessory_pricing
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const SYSTEM_TYPES = {
  PACKAGED:    'Packaged Unit',
  SPLIT:       'Standard Split',
  WALL_MOUNT:  'Wall Mount Split',
  VRF:         'VRF',
  VAV_FBP:     'VAV/FBP',
  CHILLER:     'Chiller',
  BOILER:      'Boiler',
};

// ─── TECH RATES ($/hr) ────────────────────────────────────────────────────────
// Packaged RTU installers vs refrigerant-certified technicians command different
// rates. TECH_RATE (packaged) confirmed matching Excel. The others are industry-
// standard Texas HVAC-R market rates — adjust in the Unit Schedule Settings panel
// if your Excel uses different figures.
export const TECH_RATE            = 25;  // Packaged / RTU (sheet-metal crew)
export const SPLIT_TECH_RATE      = 65;  // Standard split (HVAC-R certified)
export const WALL_MOUNT_TECH_RATE = 65;  // Wall-mount split
export const VRF_TECH_RATE        = 75;  // VRF specialist
export const FAN_TECH_RATE        = 25;  // Fan schedule
export const LD_TECH_RATE         = 25;  // Louvers & dampers

export const MISC_CONSUMABLES_PCT = 0.03; // 3% of accessories

// ─── COPPER LINE-SET LABOR RATES ─────────────────────────────────────────────
// Hours per linear foot to install refrigerant copper (both lines — braze, hang,
// insulate, pressure-test).  Calibrated against the legacy lump-sum table:
//   5-ton  (3/8" liq + 7/8"  suc, 50 ft) → (0.17+0.31)×50 = 24 hrs  ✓
//   10-ton (1/2" + 1-1/8",   50 ft)       → (0.20+0.40)×50 = 30 hrs  ✓
//   20-ton (5/8" + 1-3/8",   65 ft)       → (0.23+0.42)×65 = 42 hrs  ✓
//   50-ton (7/8" + 1-5/8",   80 ft)       → (0.31+0.47)×80 = 62 hrs  ~60
//   75-ton (1-1/8" + 2-1/8", 90 ft)       → (0.40+0.93)×90 = 120 hrs ✓
const COPPER_LABOR_PER_FT = {
  '3/8"':   0.17,
  '1/2"':   0.20,
  '5/8"':   0.23,
  '3/4"':   0.26,
  '7/8"':   0.31,
  '1-1/8"': 0.40,
  '1-3/8"': 0.42,
  '1-5/8"': 0.47,
  '2-1/8"': 0.93,
  '2-5/8"': 1.20,
};

// Labor scales by the same weight ratio used for material pricing in the engine:
//   K ≈ 40% heavier than L on average (harder to bend/braze/handle)
//   M ≈ 13% lighter than L (thin-wall, easier to work)
// Matches copperPricingEngine.js calcSplitCost/calcAHUCost weightRatioToL values.
const COPPER_TYPE_LABOR_FACTOR = { K: 1.40, L: 1.0, M: 0.87 };

// VRF blended labor hr/ft — lower than split because VRF branch lines are
// smaller and use compact manifold connections.
const VRF_COPPER_LABOR_PER_FT = {
  0: 0.045, 5: 0.050, 10: 0.060, 20: 0.070, 50: 0.080, 75: 0.100,
};

// ─── REFRIGERANT SUPPLEMENTAL CHARGE ─────────────────────────────────────────
// Automatic charge based on unit tonnage × total copper run length.
// Formula: cylinderPrice × tonFactor × lengthFactor
// Derived so the table below is reproduced exactly at the default cylinder price.
// Update refrigCylinderPrice in Settings → Copper to shift all rows at once.
//
//   Size | <50 ft | <100 ft | ≥100 ft
//      0 | $280   |  $350   |  $438
//      5 | $280   |  $350   |  $438
//     10 | $420   |  $525   |  $656
//     20 | $630   |  $788   |  $984
//     50 | $1,225 | $1,531  | $1,914
//     75 | $2,450 | $3,063  | $3,828

export const REFRIG_CYLINDER_PRICE = 280; // base price at 0-5 ton, <50 ft

const REFRIG_TON_FACTOR = {
  0: 1.000, 5: 1.000, 10: 1.500, 20: 2.250, 50: 4.375, 75: 8.750,
};

// ─── SERVICE OF EXISTING UNITS — Pricing Tables ──────────────────────────────
// Source: Unit Sched rows 19-22 (cols I-X)
// Each entry: { tons, material: {byType}, labor: {byType} }
//
// API_TODO: GET /api/pricing/service-units?version=current
//           Returns array of these entries from unit_service_pricing table

export const SERVICE_PRICING_TABLE = [
  {
    tons: 0,
    material: { packaged: 150, split: 150, wallMount: 97.5,   vrf: 300,  vav: 195,  chiller: 650,  boiler: 300 },
    labor:    { packaged: 100, split: 100, wallMount: 75,     vrf: 400,  vav: 50,   chiller: 400,  boiler: 400 },
  },
  {
    tons: 5,
    material: { packaged: 150, split: 150, wallMount: 97.5,   vrf: 300,  vav: 195,  chiller: 650,  boiler: 300 },
    labor:    { packaged: 100, split: 100, wallMount: 75,     vrf: 400,  vav: 50,   chiller: 400,  boiler: 400 },
  },
  {
    tons: 10,
    material: { packaged: 175, split: 175, wallMount: 113.75, vrf: 350,  vav: 227.5,chiller: 750,  boiler: 350 },
    labor:    { packaged: 125, split: 125, wallMount: 100,    vrf: 500,  vav: 75,   chiller: 600,  boiler: 450 },
  },
  {
    tons: 20,
    material: { packaged: 175, split: 175, wallMount: 113.75, vrf: 400,  vav: 260,  chiller: 1200, boiler: 400 },
    labor:    { packaged: 200, split: 200, wallMount: 150,    vrf: 800,  vav: 125,  chiller: 800,  boiler: 600 },
  },
  {
    tons: 50,
    material: { packaged: 250, split: 250, wallMount: 162.5,  vrf: 800,  vav: 520,  chiller: 1500, boiler: 600 },
    labor:    { packaged: 400, split: 400, wallMount: 250,    vrf: 1000, vav: 200,  chiller: 1200, boiler: 800 },
  },
  {
    tons: 75,
    material: { packaged: 350, split: 350, wallMount: 227.5,  vrf: 1500, vav: 975,  chiller: 2000, boiler: 800 },
    labor:    { packaged: 800, split: 800, wallMount: 300,    vrf: 1500, vav: 300,  chiller: 1600, boiler: 1200 },
  },
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

// ─── PACKAGED UNIT — Accessory Pricing Tables ─────────────────────────────────
// Source: Unit Sched rows 57-63, cols BD-CT
//
// API_TODO: GET /api/pricing/packaged-accessories
//           Returns packaged_unit_accessory_pricing rows

export const PKG_ACCESSORY_TABLES = {
  // [tons, materialCost]
  economizer:    [[0,1200],[5,1300],[10,1800],[20,2500],[50,6000],[75,15000]],
  standardCurb:  [[0,450], [5,500], [10,600], [20,1000],[50,6000],[75,15000]],
  metalRoofCurb: [[0,3500],[5,4000],[10,4800],[20,5500],[50,10000],[75,15000]],
  curbAdapter:   [[0,1300],[5,1600],[10,1900],[20,3500],[50,8000], [75,13000]],
  thermostat:    160,  // flat rate
  statWire:      45,   // flat rate per unit
  smokeDetector: 170,  // flat rate per detector
  pvcCond:       86,   // flat rate
  cuCond:        265,  // flat rate
  sensors:       125,  // flat rate per sensor
  newDrops:      [[0,400],[5,450],[10,500],[20,750],[50,1000],[75,1500]],
  drumLouvers:   [[0,2400],[5,2400],[10,2600],[20,3100],[50,6000],[75,9000]],
};

// Labor hours by tons for packaged units (Tech Rate = $25/hr)
// Source: Unit Sched cols BS-CT (labor hour lookup tables)
export const PKG_LABOR_HOURS = {
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

// ─── SPLIT SYSTEM — Accessory Pricing Tables ──────────────────────────────────
// Source: Unit Sched rows 86-92, cols BI-DM
//
// API_TODO: GET /api/pricing/split-accessories

export const SPLIT_ACCESSORY_TABLES = {
  condenserRails:    [[0,350],[5,350],[10,380],[20,450],[50,1200],[75,4000]],
  drainPan:          [[0,70], [5,80], [10,120],[20,180],[50,600], [75,1500]],
  cuLineUnder100:    [[0,1128],[5,1208],[10,1208],[20,3216],[50,4496],[75,6096]],
  cuLineOver100:     [[0,1692],[5,1812],[10,1812],[20,4824],[50,6744],[75,9144]],
  cuRollUnder100:    [[0,564], [5,604], [10,604], [20,1608],[50,2248],[75,3048]],
  cuRollOver100:     [[0,846], [5,906], [10,906], [20,2412],[50,3372],[75,4572]],
  oaDamper:          [[0,180],[5,225],[10,260],[20,400],[50,800],[75,1600]],
  ductTransitions:   [[0,200],[5,200],[10,300],[20,400],[50,800],[75,1600]],
  floatSwitch:       16,   // flat rate
  pvcCond:           129,  // flat rate
  cuCond:            265,  // flat rate
  thermostat:        160,  // flat rate
  statWire:          45,   // flat rate per unit
  smokeDetector:     170,  // flat rate
  sensors:           125,  // flat rate per sensor
};

// Split labor hours by tons
export const SPLIT_LABOR_HOURS = {
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

// ─── WALL MOUNT SPLIT — Accessory Pricing Tables ─────────────────────────────
// Source: Unit Sched rows 115-140, cols AP-BV
//
// API_TODO: GET /api/pricing/wall-mount-accessories

export const WALL_MOUNT_ACCESSORY_TABLES = {
  condenserRails: [[0,350],[5,350],[10,380],[20,450],[50,1200],[75,4000]],
  condPump:       [[0,150],[5,150],[10,180],[20,250],[50,600], [75,1200]],
  cuUnder100:     [[0,450],[5,450],[10,600],[20,900],[50,2000],[75,4500]],
  cuOver100:      [[0,600],[5,600],[10,800],[20,1300],[50,3000],[75,6000]],
  pvcCond:        86,   // flat rate
  cuCond:         265,  // flat rate
  thermostat:     160,  // flat rate
  statWire:       45,   // flat rate per unit
};

export const WALL_MOUNT_LABOR_HOURS = {
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

// ─── VRF SYSTEM — Accessory Pricing Tables ────────────────────────────────────
// Source: Unit Sched rows 143-169, cols AW-CB
//
// API_TODO: GET /api/pricing/vrf-accessories

export const VRF_ACCESSORY_TABLES = {
  condenserRails: [[0,400],[5,400],[10,500],[20,700],[50,1500],[75,5000]],
  drainPan:       [[0,100],[5,100],[10,130],[20,200],[50,700], [75,1600]],
  // CU line cost per foot: base rate × avg_length × indoor_units
  cuLineRatePerFt:[[0,18],[5,18],[10,20],[20,25],[50,35],[75,45]],
  // Refrigerant supplemental: per-unit charge based on avg tons
  refrigChargePerTon: 45,
  pvcCond:        86,
  cuCond:         265,
  thermostat:     160,
  smokeDetector:  170,
  sensors:        125,
  statWire:       45,
};

export const VRF_LABOR_HOURS = {
  baseUnit:      [[0,6],[5,6],[10,8],[20,10],[50,18],[75,36]],  // per indoor unit
  condenserUnit: [[0,8],[5,8],[10,10],[20,14],[50,24],[75,48]], // per outdoor CU
  condenserRails:[[0,5],[5,5],[10,7],[20,10],[50,20],[75,40]],
  drainPan:      [[0,3],[5,3],[10,4],[20,5],[50,8],[75,14]],
  cuLine:        [[0,10],[5,10],[10,12],[20,16],[50,24],[75,40]], // total for run
  pvcCond:       [[0,3],[5,3],[10,3],[20,4],[50,5],[75,7]],
  cuCond:        [[0,8],[5,8],[10,10],[20,12],[50,16],[75,20]],
  thermostat:    [[0,1],[5,1],[10,1],[20,1],[50,2],[75,3]],
  smokeDetector: [[0,2],[5,2],[10,2],[20,2],[50,3],[75,3]],
  sensors:       [[0,2],[5,2],[10,2],[20,2],[50,2],[75,2]],
  statWire:      [[0,3],[5,3],[10,3],[20,3],[50,3],[75,3]],
  startUp:       [[0,5],[5,5],[10,6],[20,8],[50,14],[75,28]],
};

// ─── COPPER LABOR HELPERS ────────────────────────────────────────────────────

/**
 * Compute copper installation labor hours from a /api/copper-pricing result.
 * Covers all four cases: manual split/wall/AHU, bracket split/wall/AHU,
 * VRF bracket (has totalFt), and VRF manual (has avgLengthFt without liquidLine).
 */
function calcCopperLaborHours(copperResult, copperType = 'L') {
  if (!copperResult) return 0;
  const typeFactor = COPPER_TYPE_LABOR_FACTOR[copperType] ?? 1.0;
  const det = copperResult.details;

  // Manual mode — split/wall/AHU: liquidLine + suctionLine + avgLengthFt
  if (copperResult.liquidLine?.size && copperResult.suctionLine?.size && Number(copperResult.avgLengthFt) > 0) {
    const lenFt  = Number(copperResult.avgLengthFt);
    const liqHrs = (COPPER_LABOR_PER_FT[copperResult.liquidLine.size]  ?? 0.20) * lenFt;
    const sucHrs = (COPPER_LABOR_PER_FT[copperResult.suctionLine.size] ?? 0.35) * lenFt;
    return round2((liqHrs + sucHrs) * typeFactor);
  }

  // Bracket mode — split/wall/AHU: details has avgLengthFt + pipe size strings
  if (Number(det?.avgLengthFt) > 0 && det?.assumedLiquidLine && det?.assumedSuctionLine) {
    const lenFt  = Number(det.avgLengthFt);
    const liqHrs = (COPPER_LABOR_PER_FT[det.assumedLiquidLine]  ?? 0.20) * lenFt;
    const sucHrs = (COPPER_LABOR_PER_FT[det.assumedSuctionLine] ?? 0.35) * lenFt;
    return round2((liqHrs + sucHrs) * typeFactor);
  }

  // VRF bracket mode: result has totalFt
  if (Number(copperResult.totalFt) > 0) {
    const ton = Number(det?.tonnage ?? 5);
    return round2(vrfCopperLaborPerFt(ton) * Number(copperResult.totalFt) * typeFactor);
  }

  // VRF manual mode: avgLengthFt is the total run (per-unit × idu already multiplied)
  if (Number(copperResult.avgLengthFt) > 0) {
    const ton = Number(det?.tonnage ?? 5);
    return round2(vrfCopperLaborPerFt(ton) * Number(copperResult.avgLengthFt) * typeFactor);
  }

  return 0;
}

function vrfCopperLaborPerFt(ton) {
  const keys = Object.keys(VRF_COPPER_LABOR_PER_FT).map(Number).sort((a, b) => a - b);
  let match = keys[0];
  for (const k of keys) { if (ton >= k) match = k; else break; }
  return VRF_COPPER_LABOR_PER_FT[match];
}

// ─── INTERPOLATION HELPERS ────────────────────────────────────────────────────
// Mirrors the Excel INDEX/MATCH with interpolation between lookup breakpoints
// This is the web equivalent of: =INDEX(table, MATCH(tons, sizes, 1))

/**
 * Look up a value from a [tons, value] table using Excel-style FLOOR match.
 * Mirrors Excel INDEX/MATCH with match_type=1:
 *   → returns the value at the largest breakpoint that is ≤ the lookup value.
 *
 * NOTE: Excel does NOT interpolate between breakpoints — it steps.
 * This corrects the earlier linear-interpolation implementation.
 */
export function lookupByTons(table, tons) {
  if (!Array.isArray(table)) return table; // flat rate — return as-is
  const t = Number(tons) || 0;
  const sorted = [...table].sort((a, b) => a[0] - b[0]);
  if (t <= sorted[0][0]) return sorted[0][1];
  if (t >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];

  // Floor match: walk forward, keep updating result until breakpoint exceeds t
  let result = sorted[0][1];
  for (let i = 0; i < sorted.length; i++) {
    if (t >= sorted[i][0]) {
      result = sorted[i][1];
    } else {
      break;
    }
  }
  return result;
}

function round2(n) { return Math.round(n * 100) / 100; }
function round0(n) { return Math.round(n); }

function calcRefrigCharge(tons, totalLengthFt, cylinderPrice = REFRIG_CYLINDER_PRICE) {
  if (!totalLengthFt || totalLengthFt <= 0) return 0;
  const t   = Number(tons) || 0;
  const keys = [0, 5, 10, 20, 50, 75];
  let tMatch = keys[0];
  for (const k of keys) { if (t >= k) tMatch = k; else break; }
  const lenFactor = totalLengthFt < 50  ? 1.0
                  : totalLengthFt < 100 ? 1.25
                  :                       1.5625;
  return round2((cylinderPrice ?? REFRIG_CYLINDER_PRICE) * REFRIG_TON_FACTOR[tMatch] * lenFactor);
}

// ─── SELECTION LOGIC ("x/xx") ─────────────────────────────────────────────────
// "x"  = We supply & install
// "xx" = Owner/GC provides, we install only (labor only, no material cost)
// ""   = Not included

/**
 * @returns {{ material: number, labor: number, hours: number }}
 */
function accessoryCost(selection, matCost, laborHours, flatLaborFlag = false) {
  if (!selection || selection === '') return { material: 0, labor: 0, hours: 0 };
  const hrs   = Number(laborHours) || 0;
  const mat   = selection === 'xx' ? 0 : (Number(matCost) || 0);
  const labor = round2(hrs * TECH_RATE);
  return { material: round2(mat), labor, hours: round2(hrs) };
}

// ─── SERVICE OF EXISTING UNIT CALCULATION ────────────────────────────────────
// Source: Unit Sched rows 18-43
// Formula: material = INDEX(materialTable, MATCH(tons, sizeCol, 1))
//           labor   = INDEX(laborTable,    MATCH(tons, sizeCol, 1))
//
// API_TODO: POST /api/estimates/service-units (persist & recalculate server-side)

export function calcServiceUnit(unit) {
  const { systemType = '', coolTons = 0, pmMaterials = 0, pmLabor = 0 } = unit;
  const typeKey = SYSTEM_TYPE_KEY_MAP[systemType] || 'packaged';
  const tonNum  = Number(coolTons) || 0;
  const pmMat   = round2(Number(pmMaterials));
  const pmLab   = round2(Number(pmLabor));

  // No tonnage entered → blank row.  Only PM add-ons count (if any).
  if (tonNum <= 0) {
    return {
      ...unit,
      serviceMaterialCost: 0,
      serviceLaborCost:    0,
      pmMaterials:  pmMat,
      pmLabor:      pmLab,
      totalMaterial: pmMat,
      totalLabor:    pmLab,
      totalCost:     round2(pmMat + pmLab),
    };
  }

  // MATCH lookup — largest breakpoint whose tons value is <= entered tons
  let matCost   = 0;
  let laborCost = 0;
  for (let i = SERVICE_PRICING_TABLE.length - 1; i >= 0; i--) {
    if (tonNum >= SERVICE_PRICING_TABLE[i].tons) {
      matCost   = SERVICE_PRICING_TABLE[i].material[typeKey] || 0;
      laborCost = SERVICE_PRICING_TABLE[i].labor[typeKey]    || 0;
      break;
    }
  }

  const totalMaterial = round2(matCost + pmMat);
  const totalLabor    = round2(laborCost + pmLab);

  return {
    ...unit,
    serviceMaterialCost: round2(matCost),
    serviceLaborCost:    round2(laborCost),
    pmMaterials:  pmMat,
    pmLabor:      pmLab,
    totalMaterial,
    totalLabor,
    totalCost: round2(totalMaterial + totalLabor),
  };
}

// ─── NEW PACKAGED UNIT CALCULATION ───────────────────────────────────────────
// Source: Unit Sched rows 56-82 (header row 56, data rows 57-81)
//
// Logic:
//   equipCost   = ownerProvided='xx' ? 0 : (quotedCost || baseCostPerTon × tons)
//   accessories = SUM of selected items × lookup-by-tons
//   misc        = accessories × MISC_CONSUMABLES_PCT
//   labor       = SUM of selected items × labor_hours × TECH_RATE
//
// API_TODO: POST /api/estimates/packaged-units

export function calcPackagedUnit(unit) {
  const {
    coolTons = 0,
    ownerProvided = '',
    baseCostPerTon = 0,
    quotedEquipCost = null,
    accessories = {},
    priceOverrides = {}, // user-editable price overrides from settings panel
  } = unit;

  const tons = Number(coolTons) || 0;

  // Blank row — no tonnage entered, return zeros
  if (tons <= 0) {
    return {
      ...unit,
      estEquipCost: 0, equipCost: 0,
      accMaterial: 0, miscPct: Number(unit.miscPct) || 3, miscCost: 0,
      totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0,
    };
  }

  // Equipment cost
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0 : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0;
  let accLabor    = 0;
  let accHours    = 0;

  // Resolve material: use override if set, else look up from table
  const resolveMat = (key, defaultTable) => {
    if (priceOverrides[key] != null && priceOverrides[key] !== '') return Number(priceOverrides[key]);
    return Array.isArray(defaultTable) ? lookupByTons(defaultTable, tons) : (Number(defaultTable) || 0);
  };

  // Helper to add an accessory — key enables price override lookup
  const addAcc = (sel, matTable, hoursTable, key = null) => {
    if (!sel || sel === '') return;
    const mat = key ? resolveMat(key, matTable) : (Array.isArray(matTable) ? lookupByTons(matTable, tons) : (Number(matTable) || 0));
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, tons) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TECH_RATE);
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

  // Smoke Detectors (qty-based, flat rate per detector)
  if (accessories.smokeDetectors && accessories.smokeDetectors !== '') {
    const qty        = accessories.smokeDetectors === 'xx' ? 0 : Number(accessories.smokeDetectors) || 1;
    const unitPrice  = resolveMat('smokeDetector', T.smokeDetector);
    const mat        = accessories.smokeDetectors === 'xx' ? 0 : round2(unitPrice * qty);
    const hrs        = round2(lookupByTons(L.smokeDetector, tons) * (Number(accessories.smokeDetectors) || 1));
    accMaterial += mat;
    accLabor    += round2(hrs * TECH_RATE);
    accHours    += hrs;
  }
  // Sensors (CO/Temp) — qty field
  if (accessories.sensorQty && Number(accessories.sensorQty) > 0) {
    const qty        = Number(accessories.sensorQty);
    const unitPrice  = resolveMat('sensors', T.sensors);
    accMaterial += round2(unitPrice * qty);
    accLabor    += round2(lookupByTons(L.sensors, tons) * qty * TECH_RATE);
    accHours    += round2(lookupByTons(L.sensors, tons) * qty);
  }

  // Base install labor (always included)
  const baseHours  = lookupByTons(L.baseUnit, tons);
  const baseLabor  = round2(baseHours * TECH_RATE);
  const startHours = lookupByTons(L.startUp, tons);
  const startLabor = round2(startHours * TECH_RATE);

  accLabor  += baseLabor + startLabor;
  accHours  += baseHours + startHours;

  // Stat wire (auto-added with thermostat)
  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat;
    accLabor    += round2(statHrs * TECH_RATE);
    accHours    += statHrs;
  }

  const miscRate     = (Number(unit.miscPct) || 3) / 100;
  const preMisc      = round2(equipCost + accMaterial);
  const misc         = round2(preMisc * miscRate);
  const totalMat     = round2(preMisc + misc);
  const totalLabor   = round2(accLabor);
  const totalCost    = round2(totalMat + totalLabor);

  return {
    ...unit,
    estEquipCost,
    equipCost,
    accMaterial:   round2(accMaterial),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    round2(accHours),
    totalCost,
  };
}

// ─── SPLIT SYSTEM CALCULATION ────────────────────────────────────────────────
// Source: Unit Sched rows 84-111
//
// API_TODO: POST /api/estimates/split-units
//
// Copper pricing integration:
//   If the row has a `copperPricingResult` (set by the CopperInputPanel after
//   calling POST /api/copper-pricing), the LME-adjusted material replaces the
//   static table price for cuLine* / cuRoll* accessories.
//   Labor hours are unchanged — only the material cost is overridden.

export function calcSplitUnit(unit) {
  const {
    coolTons = 0,
    ownerProvided = '',
    baseCostPerTon = 0,
    quotedEquipCost = null,
    accessories = {},
    techRate = SPLIT_TECH_RATE,  // allow override from settings
    priceOverrides = {},         // user-editable price overrides
    copperPricingResult = null,  // from POST /api/copper-pricing (live LME calc)
    copper = {},                 // per-row copper sub-object (for copperType)
  } = unit;

  const tons = Number(coolTons) || 0;

  // Blank row — no tonnage entered, return zeros so the summary stays clean
  if (tons <= 0) {
    return {
      ...unit,
      estEquipCost: 0, equipCost: 0,
      cuLineMaterial: 0, refrigCost: 0, cuLineHours: 0,
      accMaterial: 0, miscPct: Number(unit.miscPct) || 3, miscCost: 0,
      totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0,
    };
  }

  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0 : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0;
  let accLabor    = 0;
  let accHours    = 0;
  const TR = Number(techRate) || SPLIT_TECH_RATE;

  const T = SPLIT_ACCESSORY_TABLES;
  const L = SPLIT_LABOR_HOURS;

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

  // CU line: computed separately from accMaterial so it shows as its own badge.
  // Copper result from CopperInputPanel is always used when available;
  // static table accessories are the legacy fallback when no mode is chosen.
  const cuLineMaterial = copperPricingResult ? round2(copperPricingResult.material) : 0;
  const cuLineHours    = copperPricingResult
    ? calcCopperLaborHours(copperPricingResult, copper.copperType || 'L')
    : 0;
  const cuLineLabor    = round2(cuLineHours * TR);

  // Refrigerant supplemental charge — automatic, based on tonnage + run length.
  const refrigCost = calcRefrigCharge(tons, Number(copper.avgLengthFt) || 0, unit.refrigCylinderPrice);

  addAcc(accessories.oaDamper,        T.oaDamper,        L.oaDamper,        'oaDamper');
  addAcc(accessories.floatSwitch,     T.floatSwitch,     L.floatSwitch,     'floatSwitch');
  addAcc(accessories.pvcCond,         T.pvcCond,         L.pvcCond,         'pvcCond');
  addAcc(accessories.cuCond,          T.cuCond,          L.cuCond,          'cuCond');
  addAcc(accessories.thermostat,      T.thermostat,      L.thermostat,      'thermostat');
  addAcc(accessories.ductTransitions, T.ductTransitions, L.ductTransitions, 'ductTransitions');

  if (accessories.smokeDetectors && accessories.smokeDetectors !== '') {
    const mat = accessories.smokeDetectors === 'xx' ? 0 : resolveMat('smokeDetector', T.smokeDetector);
    const hrs = lookupByTons(L.smokeDetector, tons);
    accMaterial += mat;
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
  // Stat wire (auto-added with thermostat)
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

  const miscRate    = (Number(unit.miscPct) || 3) / 100;
  const preMisc     = round2(equipCost + cuLineMaterial + refrigCost + accMaterial);
  const misc        = round2(preMisc * miscRate);
  const totalMat    = round2(preMisc + misc);
  const totalLabor  = round2(accLabor + cuLineLabor);

  return {
    ...unit,
    estEquipCost,
    equipCost,
    cuLineMaterial,
    refrigCost,
    cuLineHours:   round2(cuLineHours),
    accMaterial:   round2(accMaterial),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    round2(accHours + cuLineHours),
    totalCost:     round2(totalMat + totalLabor),
  };
}

// ─── WALL MOUNT SPLIT CALCULATION ────────────────────────────────────────────
// Source: Unit Sched rows 113-140
//
// API_TODO: POST /api/estimates/wall-mount-units

export function calcWallMountUnit(unit) {
  const {
    coolTons = 0,
    ownerProvided = '',
    baseCostPerTon = 0,
    quotedEquipCost = null,
    accessories = {},
    techRate = WALL_MOUNT_TECH_RATE, // allow override from settings
    priceOverrides = {},             // user-editable price overrides
    copperPricingResult = null,      // from POST /api/copper-pricing
    copper = {},
  } = unit;

  const tons = Number(coolTons) || 0;

  // Blank row — no tonnage entered, return zeros
  if (tons <= 0) {
    return {
      ...unit,
      estEquipCost: 0, equipCost: 0,
      cuLineMaterial: 0, refrigCost: 0, cuLineHours: 0,
      accMaterial: 0, miscPct: Number(unit.miscPct) || 3, miscCost: 0,
      totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0,
    };
  }

  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0 : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0;
  let accLabor    = 0;
  let accHours    = 0;
  const TR = Number(techRate) || WALL_MOUNT_TECH_RATE;

  const T = WALL_MOUNT_ACCESSORY_TABLES;
  const L = WALL_MOUNT_LABOR_HOURS;

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

  // CU line: computed separately — same pattern as split units.
  const cuLineMaterial = copperPricingResult ? round2(copperPricingResult.material) : 0;
  const cuLineHours    = copperPricingResult
    ? calcCopperLaborHours(copperPricingResult, copper.copperType || 'L')
    : 0;
  const cuLineLabor    = round2(cuLineHours * TR);

  // Refrigerant supplemental charge
  const refrigCost = calcRefrigCharge(tons, Number(copper.avgLengthFt) || 0, unit.refrigCylinderPrice);

  addAcc(accessories.pvcCond,        T.pvcCond,        L.pvcCond,        'pvcCond');
  addAcc(accessories.cuCond,         T.cuCond,         L.cuCond,         'cuCond');
  addAcc(accessories.thermostat,     T.thermostat,     L.thermostat,     'thermostat');

  // Stat wire (auto-added with thermostat)
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

  const miscRate   = (Number(unit.miscPct) || 3) / 100;
  const preMisc    = round2(equipCost + cuLineMaterial + refrigCost + accMaterial);
  const misc       = round2(preMisc * miscRate);
  const totalMat   = round2(preMisc + misc);
  const totalLabor = round2(accLabor + cuLineLabor);

  return {
    ...unit,
    estEquipCost,
    equipCost,
    cuLineMaterial,
    refrigCost,
    cuLineHours:   round2(cuLineHours),
    accMaterial:   round2(accMaterial),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    round2(accHours + cuLineHours),
    totalCost:     round2(totalMat + totalLabor),
  };
}

// ─── VRF SYSTEM CALCULATION ──────────────────────────────────────────────────
// Source: Unit Sched rows 142-169
// VRF-specific: multiple condensing units, multiple indoor units, CU line length
//
// API_TODO: POST /api/estimates/vrf-units

export function calcVRFUnit(unit) {
  const {
    coolTons = 0,
    condensingUnits = 1,
    indoorUnits = 1,
    indoorCoolAvgTons = 0,
    ownerProvided = '',
    baseCostPerTon = 0,
    quotedEquipCost = null,
    cuLineAvgLength = 0,
    accessories = {},
    techRate = VRF_TECH_RATE,  // allow override from settings
    priceOverrides = {},       // user-editable price overrides
    copperPricingResult = null, // from POST /api/copper-pricing
    copper = {},
  } = unit;

  const tons = Number(coolTons) || 0;

  // Blank row — no tonnage entered, return zeros
  if (tons <= 0) {
    return {
      ...unit,
      estEquipCost: 0, equipCost: 0,
      cuLineMaterial: 0, refrigCost: 0, cuLineHours: 0,
      accMaterial: 0, miscPct: Number(unit.miscPct) || 3, miscCost: 0,
      totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0,
    };
  }

  const indoorAvg = Number(indoorCoolAvgTons) || (tons / Math.max(1, Number(indoorUnits)));
  const estEquipCost = round0(tons * Number(baseCostPerTon));
  const equipCost = ownerProvided === 'xx' ? 0 : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0;
  let accLabor    = 0;
  let accHours    = 0;
  const TR = Number(techRate) || VRF_TECH_RATE;

  const T = VRF_ACCESSORY_TABLES;
  const L = VRF_LABOR_HOURS;

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

  // CU line: computed separately as its own badge.
  const cuLineMaterial = copperPricingResult ? round2(copperPricingResult.material) : 0;
  const cuLineHours    = copperPricingResult
    ? calcCopperLaborHours(copperPricingResult, copper.copperType || 'L')
    : 0;
  const cuLineLabor    = round2(cuLineHours * TR);

  // Refrigerant supplemental charge — total run = avg length per IDU × number of IDUs.
  const totalLenFt = (Number(cuLineAvgLength) || 0) * Math.max(1, Number(indoorUnits));
  const refrigCost = calcRefrigCharge(tons, totalLenFt, unit.refrigCylinderPrice);

  if (accessories.sensorQty && Number(accessories.sensorQty) > 0) {
    const qty       = Number(accessories.sensorQty);
    const unitPrice = resolveMat('sensors', T.sensors);
    accMaterial += round2(unitPrice * qty);
    accLabor    += round2(lookupByTons(L.sensors, tons) * qty * TR);
    accHours    += round2(lookupByTons(L.sensors, tons) * qty);
  }
  // Stat wire (auto-added with thermostat)
  if (accessories.thermostat && accessories.thermostat !== '') {
    const statMat = accessories.thermostat === 'xx' ? 0 : resolveMat('statWire', T.statWire);
    const statHrs = lookupByTons(L.statWire, tons);
    accMaterial += statMat;
    accLabor    += round2(statHrs * TR);
    accHours    += statHrs;
  }

  // Base labor per indoor + per outdoor CU
  const indHrs   = round2(lookupByTons(L.baseUnit, indoorAvg)  * Number(indoorUnits));
  const cuHrs    = round2(lookupByTons(L.condenserUnit, tons)  * Number(condensingUnits));
  const startHrs = lookupByTons(L.startUp, tons);
  accLabor  += round2((indHrs + cuHrs + startHrs) * TR);
  accHours  += indHrs + cuHrs + startHrs;

  const miscRate   = (Number(unit.miscPct) || 3) / 100;
  const preMisc    = round2(equipCost + cuLineMaterial + refrigCost + accMaterial);
  const misc       = round2(preMisc * miscRate);
  const totalMat   = round2(preMisc + misc);
  const totalLabor = round2(accLabor + cuLineLabor);

  return {
    ...unit,
    estEquipCost,
    equipCost,
    cuLineMaterial,
    refrigCost,
    cuLineHours:   round2(cuLineHours),
    accMaterial:   round2(accMaterial),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    round2(accHours + cuLineHours),
    totalCost:     round2(totalMat + totalLabor),
  };
}

// ─── BATCH CALCULATORS ────────────────────────────────────────────────────────

function batchCalc(rows, calcFn) {
  const results = rows.map((r, i) => ({ id: r.id || `row-${i}`, ...calcFn(r) }));
  const totals = results.reduce(
    (acc, r) => ({
      coolTons:      acc.coolTons      + (Number(r.coolTons) || 0),
      totalMaterial: acc.totalMaterial + (r.totalMaterial || 0),
      totalLabor:    acc.totalLabor    + (r.totalLabor    || 0),
      totalHours:    acc.totalHours    + (r.totalHours    || 0),
      totalCost:     acc.totalCost     + (r.totalCost     || 0),
    }),
    { coolTons: 0, totalMaterial: 0, totalLabor: 0, totalHours: 0, totalCost: 0 }
  );
  Object.keys(totals).forEach(k => { totals[k] = round2(totals[k]); });
  return { rows: results, totals };
}

export const calcServiceBatch    = (rows) => batchCalc(rows, calcServiceUnit);
export const calcPackagedBatch   = (rows) => batchCalc(rows, calcPackagedUnit);
export const calcSplitBatch      = (rows) => batchCalc(rows, calcSplitUnit);
export const calcWallMountBatch  = (rows) => batchCalc(rows, calcWallMountUnit);
export const calcVRFBatch        = (rows) => batchCalc(rows, calcVRFUnit);

// ─── FAN SCHEDULE — Pricing & Labor Tables ───────────────────────────────────
// Source: Fan Schedule sheet — pricing by CFM capacity
// lookupByTons() reused here: the "tons" parameter is CFM for fan lookups.
//
// API_TODO: GET /api/pricing/fans

export const FAN_TYPES = [
  'Exhaust Fan', 'Supply Fan', 'Return Fan',
  'Kitchen Exhaust', 'Power Ventilator', 'Energy Recovery', 'Fan Coil',
];

export const FAN_MOUNT_TYPES = ['Roof', 'Wall', 'Inline', 'Cabinet', 'Plenum'];
export const FAN_DRIVE_TYPES  = ['Direct Drive', 'Belt Drive'];

// Base material cost per unit, indexed by CFM
export const FAN_BASE_PRICE_TABLE = [
  [0,     350],
  [200,   480],
  [500,   720],
  [1000,  1050],
  [2000,  1620],
  [3000,  2450],
  [5000,  3900],
  [10000, 6800],
];

export const FAN_ACCESSORY_TABLES = {
  disconnectSwitch: 95,    // flat
  gfiOutlet:        75,    // flat
  backdraftDamper: [[0,90],[200,125],[500,185],[1000,270],[2000,420],[5000,750],[10000,1200]],
  curb:            [[0,265],[200,330],[500,440],[1000,670],[2000,1020],[5000,1850],[10000,3200]],
  flexConnection:   65,    // flat
  vfd:             [[0,370],[200,490],[500,740],[1000,1120],[2000,1850],[5000,3300],[10000,5800]],
  birdScreen:      [[0,50],[200,75],[500,115],[1000,185],[2000,300],[5000,540],[10000,940]],
  wiring:          [[0,140],[200,170],[500,210],[1000,260],[2000,330],[5000,500],[10000,750]],
};

export const FAN_LABOR_HOURS = {
  baseInstall: [[0,3.5],[200,4.5],[500,5.5],[1000,7.5],[2000,11],[3000,15],[5000,20],[10000,30]],
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

// ─── FAN CALCULATION ──────────────────────────────────────────────────────────
// Equipment cost = quotedCost || unitPrice || CFM-based lookup
// Accessories use x/xx selection identical to other unit types
//
// API_TODO: POST /api/estimates/fans

export function calcFanUnit(unit) {
  const {
    cfm = 0,
    ownerProvided = '',
    unitPrice = 0,
    quotedEquipCost = null,
    accessories = {},
  } = unit;

  const c = Number(cfm) || 0;

  // Equipment cost
  const estEquipCost = round0(
    Number(unitPrice) > 0 ? Number(unitPrice) : lookupByTons(FAN_BASE_PRICE_TABLE, c)
  );
  const equipCost = ownerProvided === 'xx'
    ? 0
    : (quotedEquipCost != null ? Number(quotedEquipCost) : estEquipCost);

  let accMaterial = 0;
  let accLabor    = 0;
  let accHours    = 0;

  const addAcc = (sel, matTable, hoursTable) => {
    if (!sel || sel === '') return;
    const mat = Array.isArray(matTable) ? lookupByTons(matTable, c) : (Number(matTable) || 0);
    const hrs = Array.isArray(hoursTable) ? lookupByTons(hoursTable, c) : (Number(hoursTable) || 0);
    accMaterial += sel === 'xx' ? 0 : round2(mat);
    accLabor    += round2(hrs * TECH_RATE);
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

  // Base install + start-up (always included when CFM > 0)
  const baseHrs  = lookupByTons(L.baseInstall, c);
  const startHrs = lookupByTons(L.startUp, c);
  accLabor  += round2((baseHrs + startHrs) * TECH_RATE);
  accHours  += baseHrs + startHrs;

  const miscRate    = (Number(unit.miscPct) || 3) / 100;
  const preMisc     = round2(equipCost + accMaterial);
  const misc        = round2(preMisc * miscRate);
  const totalMat    = round2(preMisc + misc);
  const totalLabor  = round2(accLabor);

  return {
    ...unit,
    estEquipCost,
    equipCost,
    accMaterial:   round2(accMaterial),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    round2(accHours),
    totalCost:     round2(totalMat + totalLabor),
  };
}

// ─── LOUVERS & DAMPERS — Pricing Tables ───────────────────────────────────────
// Source: Louvers & FD sheet — pricing per sq ft of face area
// Face area = (widthIn/12) × (heightIn/12)   [sq ft]
//
// API_TODO: GET /api/pricing/louvers-dampers

export const LOUVER_DAMPER_TYPES = [
  'OA Louver', 'Supply Louver', 'Return Louver', 'Relief Louver', 'Fixed Louver',
  'Fire Damper', 'Smoke Damper', 'Combination FSD', 'Volume Damper', 'Backdraft Damper',
];

export const LOUVER_DAMPER_PRICING = {
  'OA Louver':         { matPerSqFt: 15,  laborHrsPerSqFt: 0.60 },
  'Supply Louver':     { matPerSqFt: 13,  laborHrsPerSqFt: 0.50 },
  'Return Louver':     { matPerSqFt: 13,  laborHrsPerSqFt: 0.50 },
  'Relief Louver':     { matPerSqFt: 11,  laborHrsPerSqFt: 0.40 },
  'Fixed Louver':      { matPerSqFt: 10,  laborHrsPerSqFt: 0.40 },
  'Fire Damper':       { matPerSqFt: 22,  laborHrsPerSqFt: 1.50 },
  'Smoke Damper':      { matPerSqFt: 34,  laborHrsPerSqFt: 2.00 },
  'Combination FSD':   { matPerSqFt: 44,  laborHrsPerSqFt: 2.50 },
  'Volume Damper':     { matPerSqFt: 9,   laborHrsPerSqFt: 0.80 },
  'Backdraft Damper':  { matPerSqFt: 8,   laborHrsPerSqFt: 0.60 },
};

const LD_MIN_MAT   = 65;   // minimum material per unit
const LD_MIN_HRS   = 0.5;  // minimum labor hours per unit

// Accessory costs (applied per unit before multiplying by qty)
export const LD_ACCESSORIES = {
  screen:   { perSqFt: 4.5,  hoursPerSqFt: 0.15, minMat: 35 },
  actuator: { flat: 285,     flatHours: 2.0 },
  sleeve:   { perSqFt: 6.5,  hoursPerSqFt: 0.20, minMat: 45 },
};

// ─── LOUVER / DAMPER CALCULATION ─────────────────────────────────────────────
// Face area drives material, labor, and accessory costs.
// Qty multiplies the per-unit total.
//
// API_TODO: POST /api/estimates/louvers-dampers

export function calcLouverDamperUnit(unit) {
  const {
    type = 'OA Louver',
    widthIn = 0,
    heightIn = 0,
    qty = 1,
    ownerProvided = '',
    unitPrice = 0,     // optional override for unit material cost
    accessories = {},
  } = unit;

  const w = Number(widthIn) || 0;
  const h = Number(heightIn) || 0;
  const q = Math.max(1, Number(qty));
  const faceArea = round2((w / 12) * (h / 12));   // sq ft

  const pricing = LOUVER_DAMPER_PRICING[type] || LOUVER_DAMPER_PRICING['OA Louver'];

  // Per-unit base material
  const baseMat = Math.max(LD_MIN_MAT, faceArea * pricing.matPerSqFt);
  const baseHrs = Math.max(LD_MIN_HRS, faceArea * pricing.laborHrsPerSqFt);

  const unitMat = ownerProvided === 'xx'
    ? 0
    : (Number(unitPrice) > 0 ? Number(unitPrice) : baseMat);

  // Per-unit accessories
  let accMatPerUnit  = 0;
  let accHrsPerUnit  = 0;

  if (accessories.screen && accessories.screen !== '') {
    const mat = accessories.screen === 'xx' ? 0 : Math.max(LD_ACCESSORIES.screen.minMat, faceArea * LD_ACCESSORIES.screen.perSqFt);
    accMatPerUnit  += mat;
    accHrsPerUnit  += faceArea * LD_ACCESSORIES.screen.hoursPerSqFt + 0.25;
  }
  if (accessories.actuator && accessories.actuator !== '') {
    const mat = accessories.actuator === 'xx' ? 0 : LD_ACCESSORIES.actuator.flat;
    accMatPerUnit  += mat;
    accHrsPerUnit  += LD_ACCESSORIES.actuator.flatHours;
  }
  if (accessories.sleeve && accessories.sleeve !== '') {
    const mat = accessories.sleeve === 'xx' ? 0 : Math.max(LD_ACCESSORIES.sleeve.minMat, faceArea * LD_ACCESSORIES.sleeve.perSqFt);
    accMatPerUnit  += mat;
    accHrsPerUnit  += faceArea * LD_ACCESSORIES.sleeve.hoursPerSqFt + 0.25;
  }

  // Apply qty
  const totalUnitMat = round2((unitMat + accMatPerUnit) * q);
  const totalHrs     = round2((baseHrs + accHrsPerUnit) * q);
  const totalLabor   = round2(totalHrs * TECH_RATE);
  const miscRate     = (Number(unit.miscPct) || 3) / 100;
  const misc         = round2(totalUnitMat * miscRate);
  const totalMat     = round2(totalUnitMat + misc);

  return {
    ...unit,
    faceArea,
    baseMat:       round2(baseMat),
    unitMat:       round2(unitMat),
    accMaterial:   round2(accMatPerUnit * q),
    miscPct:       Number(unit.miscPct) || 3,
    miscCost:      misc,
    totalMaterial: totalMat,
    totalLabor,
    totalHours:    totalHrs,
    totalCost:     round2(totalMat + totalLabor),
  };
}

// ─── BATCH CALCULATORS (Fan + Louver/Damper) ─────────────────────────────────
export const calcFanBatch          = (rows) => batchCalc(rows, calcFanUnit);
export const calcLouverDamperBatch = (rows) => batchCalc(rows, calcLouverDamperUnit);

// ─── GRAND SUMMARY ROLL-UP ────────────────────────────────────────────────────
// Source: Unit Sched rows 2-11 (Unit Summary section)
// Mirrors Summary sheet roll-up logic
//
// API_TODO: GET /api/estimates/{projectId}/unit-schedule/summary

export function rollUpUnitSummary({
  serviceTotals, packagedTotals, splitTotals, wallMountTotals, vrfTotals,
  fanTotals, louverDamperTotals,
}) {
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
