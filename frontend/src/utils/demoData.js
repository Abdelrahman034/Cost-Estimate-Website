/**
 * demoData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-built demo rows for every estimating module.
 * Used by DemoSetup.jsx to inject realistic data into localStorage so the
 * entire app can be demonstrated without any manual data entry.
 *
 * Project scenario: "Silverstone Corporate Center – Phase 2"
 *   3-story office building, ~22,000 SF
 *   Location: San Antonio, TX
 *   GC: Bartlett Cocke General Contractors
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Project info (stored in App state via Header) ────────────────────────────
export const DEMO_PROJECT_INFO = {
  projectName:    'Silverstone Corporate Center – Phase 2',
  location:       'San Antonio, TX 78230',
  owner:          'Silverstone Properties LLC',
  gc:             'Bartlett Cocke General Contractors',
  bidDate:        (() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })(),
  companyName:    'Your HVAC Company',
  companyAddress: '1234 Trade Center Dr, San Antonio, TX 78230',
  companyPhone:   '(210) 555-0182',
  companyEmail:   'estimating@yourhvac.com',
};

// ─── Module: Unit Schedule ────────────────────────────────────────────────────
export const DEMO_UNIT_SCHEDULE = {
  serviceRows: [
    {
      id: 's-demo-1', name: 'RTU-101 (Existing Lobby)',
      coolTons: 10, systemType: 'Packaged Unit',
      pmMaterials: 0, pmLabor: 0,
    },
  ],
  packagedRows: [
    {
      id: 'p-demo-1', name: 'RTU-1 (Lobby / Level 1)',
      coolTons: 10, ownerProvided: '',
      baseCostPerTon: 850, quotedEquipCost: null,
      accessories: {
        standardCurb: 'x', metalRoofCurb: '', curbAdapter: '', economizer: 'x',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '2',
        sensorQty: 0, newDrops: '', drumLouvers: '',
      },
    },
    {
      id: 'p-demo-2', name: 'RTU-2 (Level 2 Open Office)',
      coolTons: 15, ownerProvided: '',
      baseCostPerTon: 820, quotedEquipCost: null,
      accessories: {
        standardCurb: 'x', metalRoofCurb: '', curbAdapter: '', economizer: 'x',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '2',
        sensorQty: 0, newDrops: '', drumLouvers: '',
      },
    },
    {
      id: 'p-demo-3', name: 'RTU-3 (Level 3 Open Office)',
      coolTons: 15, ownerProvided: '',
      baseCostPerTon: 820, quotedEquipCost: null,
      accessories: {
        standardCurb: 'x', metalRoofCurb: '', curbAdapter: '', economizer: 'x',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '2',
        sensorQty: 0, newDrops: '', drumLouvers: '',
      },
    },
    {
      id: 'p-demo-4', name: 'RTU-4 (Conference Rooms)',
      coolTons: 7.5, ownerProvided: '',
      baseCostPerTon: 900, quotedEquipCost: null,
      accessories: {
        standardCurb: 'x', metalRoofCurb: '', curbAdapter: '', economizer: '',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '1',
        sensorQty: 0, newDrops: '', drumLouvers: '',
      },
    },
  ],
  splitRows: [
    {
      id: 'sp-demo-1', name: 'AHU-1 (Server Room 2F)',
      coolTons: 2, ownerProvided: '',
      baseCostPerTon: 1200, quotedEquipCost: null,
      accessories: {
        condenserRails: 'x', drainPan: '', cuLineUnder100: 'x', cuLineOver100: '',
        cuRollUnder100: '', cuRollOver100: '', oaDamper: '', floatSwitch: 'x',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '1',
        sensorQty: 1, ductTransitions: 'x',
      },
    },
    {
      id: 'sp-demo-2', name: 'AHU-2 (IT Closet 3F)',
      coolTons: 3, ownerProvided: '',
      baseCostPerTon: 1100, quotedEquipCost: null,
      accessories: {
        condenserRails: 'x', drainPan: '', cuLineUnder100: 'x', cuLineOver100: '',
        cuRollUnder100: '', cuRollOver100: '', oaDamper: '', floatSwitch: 'x',
        pvcCond: 'x', cuCond: '', thermostat: 'x', smokeDetectors: '',
        sensorQty: 0, ductTransitions: 'x',
      },
    },
  ],
  wallMountRows: [],
  vrfRows: [],
  fanRows: [
    {
      id: 'f-demo-1', name: 'EF-1 (Restroom 1F)',
      type: 'Upblast Exhaust Fan', cfm: 800,
      mount: 'Roof', drive: 'Direct Drive',
      ownerProvided: '', unitPrice: 0, quotedEquipCost: null,
      accessories: {
        disconnectSwitch: 'x', gfiOutlet: '', backdraftDamper: 'x',
        curb: 'x', flexConnection: '', vfd: '', birdScreen: 'x', wiring: '',
      },
    },
    {
      id: 'f-demo-2', name: 'EF-2 (Restroom 2F)',
      type: 'Upblast Exhaust Fan', cfm: 800,
      mount: 'Roof', drive: 'Direct Drive',
      ownerProvided: '', unitPrice: 0, quotedEquipCost: null,
      accessories: {
        disconnectSwitch: 'x', gfiOutlet: '', backdraftDamper: 'x',
        curb: 'x', flexConnection: '', vfd: '', birdScreen: 'x', wiring: '',
      },
    },
    {
      id: 'f-demo-3', name: 'EF-3 (Restroom 3F)',
      type: 'Upblast Exhaust Fan', cfm: 800,
      mount: 'Roof', drive: 'Direct Drive',
      ownerProvided: '', unitPrice: 0, quotedEquipCost: null,
      accessories: {
        disconnectSwitch: 'x', gfiOutlet: '', backdraftDamper: 'x',
        curb: 'x', flexConnection: '', vfd: '', birdScreen: 'x', wiring: '',
      },
    },
    {
      id: 'f-demo-4', name: 'SF-1 (Lobby Makeup Air)',
      type: 'Inline Centrifugal Fan', cfm: 2400,
      mount: 'Ceiling', drive: 'Belt Drive',
      ownerProvided: '', unitPrice: 0, quotedEquipCost: null,
      accessories: {
        disconnectSwitch: 'x', gfiOutlet: '', backdraftDamper: 'x',
        curb: '', flexConnection: 'x', vfd: 'x', birdScreen: '', wiring: '',
      },
    },
  ],
  louverDamperRows: [
    {
      id: 'ld-demo-1', name: 'OA-1 (Rooftop OA)',
      type: 'Fixed Aluminum Louver',
      widthIn: 48, heightIn: 36, qty: 4,
      ownerProvided: '', unitPrice: 0,
      accessories: { screen: 'x', actuator: '', sleeve: 'x' },
    },
    {
      id: 'ld-demo-2', name: 'FD-1 (Corridor FD)',
      type: 'Fire Damper',
      widthIn: 24, heightIn: 20, qty: 8,
      ownerProvided: '', unitPrice: 0,
      accessories: { screen: '', actuator: 'x', sleeve: '' },
    },
  ],
};

// ─── Module: Metal Duct ────────────────────────────────────────────────────────
// Row format matches MetalDuctModule newRow() exactly
const makeDuctRow = (id, size, linearFeet, opts = {}) => ({
  id,
  size,
  linearFeet,
  ductType:          opts.ductType           ?? 'supply',
  fittings:          opts.fittings           ?? [],
  insulated:         opts.insulated          ?? false,
  internalInsulation:opts.internalInsulation ?? false,
  flexDuct:          opts.flexDuct           ?? false,
  vd:                opts.vd                 ?? false,
  offtake:           opts.offtake            ?? false,
  difficultyFactor:  opts.difficultyFactor   ?? 1.0,
  wasteFactor:       opts.wasteFactor        ?? 0.10,
  notes:             opts.notes              ?? '',
});

export const DEMO_METAL_DUCT = {
  rows: [
    makeDuctRow('md-1',  '24x12', 120, { insulated:true,  ductType:'supply', vd:true  }),
    makeDuctRow('md-2',  '20x12',  95, { insulated:true,  ductType:'supply'           }),
    makeDuctRow('md-3',  '20x10',  85, { insulated:true,  ductType:'supply', offtake:true }),
    makeDuctRow('md-4',  '18x10',  65, { insulated:false, ductType:'supply'           }),
    makeDuctRow('md-5',  '16x8',   95, { insulated:true,  ductType:'supply'           }),
    makeDuctRow('md-6',  '14x8',  110, { insulated:true,  ductType:'supply'           }),
    makeDuctRow('md-7',  '12x8',   75, { insulated:false, ductType:'return'           }),
    makeDuctRow('md-8',  '10x8',   60, { flexDuct:true,   ductType:'return'           }),
    makeDuctRow('md-9',  '8x8',    45, { flexDuct:true,   ductType:'return'           }),
    makeDuctRow('md-10', '14',     40, { insulated:true,  ductType:'supply'           }),
    makeDuctRow('md-11', '12',     35, { insulated:true,  ductType:'supply'           }),
    makeDuctRow('md-12', '10',     30, { flexDuct:true,   ductType:'supply'           }),
  ],
};

// ─── Module: Diffuser Schedule ────────────────────────────────────────────────
export const DEMO_DIFFUSER = {
  rows: [
    { id:'df-demo-1', typeId:'24x24-4way', qty:18, sheetrock:false, quotedPrice:0 },
    { id:'df-demo-2', typeId:'12x12-2way', qty:12, sheetrock:false, quotedPrice:0 },
    { id:'df-demo-3', typeId:'24x24-4way', qty:6,  sheetrock:true,  quotedPrice:0 },
    { id:'df-demo-4', typeId:'linear-bar', qty:8,  sheetrock:false, quotedPrice:0 },
    { id:'df-demo-5', typeId:'eggcrate',   qty:4,  sheetrock:false, quotedPrice:0 },
    { id:'df-demo-6', typeId:'12x12-2way', qty:6,  sheetrock:true,  quotedPrice:0 },
  ],
};

// ─── Module: Fan Schedule ─────────────────────────────────────────────────────
export const DEMO_FAN_SCHEDULE = {
  rows: [
    {
      id:'fs-demo-1', name:'EF-1 (1F Men\'s)',
      type:'Upblast Exhaust Fan', cfm:500, mount:'Roof', drive:'Direct Drive',
      ownerProvided:'', unitPrice:485, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'x', flexConnection:'', vfd:'', birdScreen:'x',
      },
    },
    {
      id:'fs-demo-2', name:'EF-2 (1F Women\'s)',
      type:'Upblast Exhaust Fan', cfm:500, mount:'Roof', drive:'Direct Drive',
      ownerProvided:'', unitPrice:485, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'x', flexConnection:'', vfd:'', birdScreen:'x',
      },
    },
    {
      id:'fs-demo-3', name:'EF-3 (2F Restrooms)',
      type:'Upblast Exhaust Fan', cfm:800, mount:'Roof', drive:'Direct Drive',
      ownerProvided:'', unitPrice:620, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'x', flexConnection:'', vfd:'', birdScreen:'x',
      },
    },
    {
      id:'fs-demo-4', name:'EF-4 (3F Restrooms)',
      type:'Upblast Exhaust Fan', cfm:800, mount:'Roof', drive:'Direct Drive',
      ownerProvided:'', unitPrice:620, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'x', flexConnection:'', vfd:'', birdScreen:'x',
      },
    },
    {
      id:'fs-demo-5', name:'SF-1 (Lobby Makeup Air)',
      type:'Inline Centrifugal Fan', cfm:2400, mount:'Ceiling', drive:'Belt Drive',
      ownerProvided:'', unitPrice:1850, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'', flexConnection:'x', vfd:'x', birdScreen:'',
      },
    },
    {
      id:'fs-demo-6', name:'SF-2 (Electrical Rm)',
      type:'Wall Mounted Prop Fan', cfm:600, mount:'Wall', drive:'Direct Drive',
      ownerProvided:'', unitPrice:280, accessories:{
        disconnectSwitch:'x', gfiOutlet:'', backdraftDamper:'x',
        curb:'', flexConnection:'', vfd:'', birdScreen:'',
      },
    },
  ],
};

// ─── Module: Electric Heat ────────────────────────────────────────────────────
export const DEMO_ELEC_HEAT = {
  rows: [
    { id:'eh-demo-1', name:'UH-1 (Main Entrance)',   kw:5,  qty:1, unitPrice:0 },
    { id:'eh-demo-2', name:'UH-2 (Side Entrance)',   kw:3,  qty:1, unitPrice:0 },
    { id:'eh-demo-3', name:'UH-3 (Loading Dock)',    kw:8,  qty:1, unitPrice:0 },
    { id:'eh-demo-4', name:'UH-4 (Stairwell 1)',     kw:2,  qty:2, unitPrice:0 },
    { id:'eh-demo-5', name:'UH-5 (Parking Entry)',   kw:10, qty:1, unitPrice:0 },
  ],
};

// ─── Module totals (for Dashboard) ───────────────────────────────────────────
// These are injected directly into localStorage so the Dashboard shows
// populated totals before the user opens each module.
export const DEMO_MODULE_TOTALS = {
  unit_schedule: { totalMaterial: 87400, totalLabor: 23600, totalCost: 111000 },
  metal_duct:    { totalMaterial: 38200, totalLabor: 19400, totalCost:  57600 },
  diffuser:      { totalMaterial:  9200, totalLabor:  3800, totalCost:  13000 },
  fan_schedule:  { totalMaterial: 14600, totalLabor:  5200, totalCost:  19800 },
  vav_schedule:  { totalMaterial:     0, totalLabor:     0, totalCost:      0 },
  cw_pipe:       { totalMaterial:     0, totalLabor:     0, totalCost:      0 },
  elec_heat:     { totalMaterial:  4800, totalLabor:  2100, totalCost:   6900 },
};

// ─── Change Log entries ───────────────────────────────────────────────────────
export const DEMO_CHANGELOG = [
  {
    id: 'cl-1', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    type: 'scope_add', module: 'Unit Schedule',
    description: 'Added RTU-4 (7.5T) for conference room wing per revised drawings.',
    delta: '+$14,200',
  },
  {
    id: 'cl-2', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    type: 'price_change', module: 'Metal Duct',
    description: 'Updated steel pricing from $1.35/lb to $1.45/lb per current market.',
    delta: '+$2,800',
  },
  {
    id: 'cl-3', timestamp: new Date(Date.now() - 86400000).toISOString(),
    type: 'scope_add', module: 'Electric Heat',
    description: 'Added UH-5 at parking garage entry per RFI-012 response.',
    delta: '+$3,100',
  },
  {
    id: 'cl-4', timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    type: 'value_engineering', module: 'Diffuser',
    description: 'VE proposal: swap 6 sheetrock diffusers to standard to reduce cost.',
    delta: '-$900',
  },
];

// ─── Scenario comparison ──────────────────────────────────────────────────────
export const DEMO_SCENARIOS = {
  scenarios: [
    {
      id: 'sc-1', label: 'Base Bid',
      overhead: 0.15, profit: 0.10, notes: 'Standard markup',
      directCost: 208300,
    },
    {
      id: 'sc-2', label: 'Aggressive (Win Strategy)',
      overhead: 0.12, profit: 0.07, notes: 'Reduced margin to compete',
      directCost: 208300,
    },
    {
      id: 'sc-3', label: 'Full Margin',
      overhead: 0.18, profit: 0.14, notes: 'If budget allows',
      directCost: 208300,
    },
  ],
};
