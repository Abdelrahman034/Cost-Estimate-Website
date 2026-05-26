/**
 * CopperPricingCalculator.jsx
 * ============================================================
 * React component — dynamic copper pricing calculator.
 *
 * Mirrors the logic in copperPricingEngine.js for frontend use.
 * In production, wire calcPrice() to POST /api/copper-pricing
 * and remove the inline engine constants — this file is the
 * presentation layer only.
 *
 * For now the engine constants are inlined so the component
 * works standalone without a running backend.
 * ============================================================
 */

import { useState, useMemo, useCallback } from 'react';

// ──────────────────────────────────────────────────────────────
// ENGINE CONSTANTS (mirrored from copperPricingEngine.js)
// In production: fetch from /api/copper-pricing/meta
// ──────────────────────────────────────────────────────────────
const BASELINE_LME = 4.25;

const PIPE_WEIGHTS = {
  '3/8"':   { K: 0.198, L: 0.145, M: 0.126 },
  '1/2"':   { K: 0.269, L: 0.198, M: 0.153 },
  '5/8"':   { K: 0.344, L: 0.285, M: 0.220 },
  '3/4"':   { K: 0.481, L: 0.362, M: 0.285 },
  '7/8"':   { K: 0.641, L: 0.455, M: 0.362 },
  '1-1/8"': { K: 0.839, L: 0.655, M: 0.516 },
  '1-3/8"': { K: 1.040, L: 0.884, M: 0.694 },
  '1-5/8"': { K: 1.360, L: 1.140, M: 0.901 },
  '2-1/8"': { K: 2.060, L: 1.750, M: 1.460 },
};

const VRV_BASELINE = {
  '3/8"': 3.00, '1/2"': 4.00, '5/8"': 4.00, '3/4"': 5.20,
  '7/8"': 7.60, '1-1/8"': 9.50, '1-3/8"': 12.88,
  '1-5/8"': 16.70, '2-1/8"': 32.00,
};

const INSULATION = {
  '3/8"': 1.00, '1/2"': 1.00, '5/8"': 1.00, '3/4"': 1.20,
  '7/8"': 1.25, '1-1/8"': 1.50, '1-3/8"': 1.75,
  '1-5/8"': 2.00, '2-1/8"': 2.50,
};

const VRV_BLENDED = {
  0:  { basePerFt: 5.200  },
  5:  { basePerFt: 8.125  },
  10: { basePerFt: 12.090 },
  20: { basePerFt: 18.330 },
  50: { basePerFt: 33.280 },
  75: { basePerFt: 43.225 },
};

const BASELINE_PRICES = {
  split: {
    0:  { copperL: { short: 1128, long: 1692 }, copperRoll: { short: 564,  long: 846  } },
    5:  { copperL: { short: 1208, long: 1812 }, copperRoll: { short: 604,  long: 906  } },
    10: { copperL: { short: 1208, long: 1812 }, copperRoll: { short: 604,  long: 906  } },
    20: { copperL: { short: 3216, long: 4824 }, copperRoll: { short: 1608, long: 2412 } },
    50: { copperL: { short: 4496, long: 6744 }, copperRoll: { short: 2248, long: 3372 } },
    75: { copperL: { short: 6096, long: 9144 }, copperRoll: { short: 3048, long: 4572 } },
  },
  wallMounted: {
    0:  { copperL: { short: 1128, long: 1692 }, copperRoll: { short: 564,  long: 846  } },
    5:  { copperL: { short: 1208, long: 1812 }, copperRoll: { short: 604,  long: 906  } },
    10: { copperL: { short: 1208, long: 1812 }, copperRoll: { short: 604,  long: 906  } },
    20: { copperL: { short: 3216, long: 4824 }, copperRoll: { short: 1608, long: 2412 } },
    50: { copperL: { short: 4496, long: 6744 }, copperRoll: { short: 2248, long: 3372 } },
    75: { copperL: { short: 6096, long: 9144 }, copperRoll: { short: 3048, long: 4572 } },
  },
  ahuWithCU: {
    0:  { short: 360,  long: 540  },
    5:  { short: 360,  long: 540  },
    10: { short: 440,  long: 660  },
    20: { short: 520,  long: 780  },
    50: { short: 680,  long: 1020 },
    75: { short: 880,  long: 1320 },
  },
};

const COPPER_FRACTIONS = {
  split:       { 0: 0.31, 5: 0.44, 10: 0.56, 20: 0.45, 50: 0.50, 75: 0.55 },
  wallMounted: { 0: 0.31, 5: 0.44, 10: 0.56, 20: 0.45, 50: 0.50, 75: 0.55 },
  ahuWithCU:   { 0: 0.35, 5: 0.40, 10: 0.45, 20: 0.50, 50: 0.55, 75: 0.60 },
  vrv:         { 0: 0.45, 5: 0.45, 10: 0.45, 20: 0.45, 50: 0.45, 75: 0.45 },
};

const TONNAGES   = [0, 5, 10, 20, 50, 75];
const PIPE_SIZES = Object.keys(VRV_BASELINE);

// ──────────────────────────────────────────────────────────────
// INLINE ENGINE FUNCTIONS
// ──────────────────────────────────────────────────────────────
function calcLumpSum(equipType, tonnage, isLongRun, lineSetType, copperType, lme, safety, cfOverride) {
  const bp     = equipType === 'ahuWithCU'
    ? BASELINE_PRICES.ahuWithCU[tonnage]
    : BASELINE_PRICES[equipType][tonnage]?.[lineSetType];
  if (!bp) return null;
  const baseline = isLongRun ? bp.long : bp.short;

  const typeRatio = copperType === 'K' ? 1.40 : copperType === 'M' ? 0.87 : 1;
  const cf        = (cfOverride ?? COPPER_FRACTIONS[equipType]?.[tonnage] ?? 0.45) * typeRatio;
  const lmeRatio  = lme / BASELINE_LME;
  const adj       = baseline * (1 + cf * (lmeRatio - 1)) * safety;
  return { baseline, adjusted: Math.round(adj), delta: Math.round(adj - baseline), changePercent: +((adj / baseline - 1) * 100).toFixed(1), cf };
}

function calcVRVPipe(size, copperType, lme, withInsulation, safety) {
  const wL     = PIPE_WEIGHTS[size]['L'];
  const w      = PIPE_WEIGHTS[size][copperType];
  const typePF = w / wL;
  const base   = (VRV_BASELINE[size] ?? 0) * typePF;
  const delta  = w * (lme - BASELINE_LME);
  const ins    = withInsulation ? (INSULATION[size] ?? 0) : 0;
  const total  = +((base + delta + ins) * safety).toFixed(2);
  return { base: +base.toFixed(2), delta: +delta.toFixed(3), ins, total };
}

function calcVRVBlended(tonnage, lme, safety, cfOverride) {
  const base  = VRV_BLENDED[tonnage]?.basePerFt ?? 0;
  const cf    = cfOverride ?? COPPER_FRACTIONS.vrv[tonnage] ?? 0.45;
  const adj   = +(base * (1 + cf * (lme / BASELINE_LME - 1)) * safety).toFixed(2);
  return { base, adjusted: adj, delta: +(adj - base).toFixed(2) };
}

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const clr = (pct) => pct > 0 ? '#d9534f' : pct < 0 ? '#4cae4c' : '#555';

// ──────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────

function ParamCard({ children }) {
  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <label style={{ fontSize: 13, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>{children}</label>;
}

function NumInput({ value, onChange, min, max, step = 0.01, style = {} }) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: '100%', padding: '6px 10px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 14, ...style }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '6px 10px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 14 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DeltaBadge({ pct }) {
  if (pct === 0) return <span style={{ color: '#555', fontSize: 12 }}>no change</span>;
  return (
    <span style={{ color: clr(pct), fontSize: 12, fontWeight: 600 }}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ResultRow({ label, baseline, adjusted, delta, pct }) {
  return (
    <tr>
      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: 13 }}>{label}</td>
      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: 13, textAlign: 'right', color: '#777' }}>{fmtInt(baseline)}</td>
      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{fmtInt(adjusted)}</td>
      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: 13, textAlign: 'right', color: clr(delta) }}>
        {delta >= 0 ? '+' : ''}{fmtInt(delta)}
      </td>
      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
        <DeltaBadge pct={pct} />
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────────────────────
// VIEWS
// ──────────────────────────────────────────────────────────────

function LumpSumView({ equipType, lme, safetyFactors, copperType, cfOverrides }) {
  const safety   = safetyFactors[equipType] ?? 1.0;
  const hasRoll  = equipType !== 'ahuWithCU';
  const headers  = hasRoll
    ? ['Tons', 'CopperL <100 ft', 'CopperL ≥100 ft', 'Roll <100 ft', 'Roll ≥100 ft']
    : ['Tons', 'Copper <100 ft', 'Copper ≥100 ft'];

  const rows = TONNAGES.map(ton => {
    if (equipType === 'ahuWithCU') {
      const s = calcLumpSum('ahuWithCU', ton, false, null, copperType, lme, safety, cfOverrides[ton]);
      const l = calcLumpSum('ahuWithCU', ton, true,  null, copperType, lme, safety, cfOverrides[ton]);
      return { ton, cells: [s, l] };
    }
    const cls = calcLumpSum(equipType, ton, false, 'copperL',   copperType, lme, safety, cfOverrides[ton]);
    const cll = calcLumpSum(equipType, ton, true,  'copperL',   copperType, lme, safety, cfOverrides[ton]);
    const crs = calcLumpSum(equipType, ton, false, 'copperRoll',copperType, lme, safety, cfOverrides[ton]);
    const crl = calcLumpSum(equipType, ton, true,  'copperRoll',copperType, lme, safety, cfOverrides[ton]);
    return { ton, cells: [cls, cll, crs, crl] };
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#343a40', color: '#fff' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Tons' ? 'left' : 'right', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ton, cells }) => (
            <tr key={ton} style={{ background: ton % 2 === 0 ? '#fff' : '#f8f9fa' }}>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{ton === 0 ? 'Base' : `${ton}T`}</td>
              {cells.map((c, i) => (
                <td key={i} style={{ padding: '7px 10px', textAlign: 'right' }}>
                  <span style={{ fontWeight: 600 }}>{fmtInt(c?.adjusted)}</span>
                  {' '}
                  <DeltaBadge pct={c?.changePercent ?? 0} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VRVPipeSizeView({ lme, copperType, withInsulation, safety }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#343a40', color: '#fff' }}>
            {['Pipe Size', 'Baseline $/ft', 'Copper Δ $/ft', 'Insulation $/ft', 'Adjusted $/ft'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Pipe Size' ? 'left' : 'right', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PIPE_SIZES.map((size, i) => {
            const r = calcVRVPipe(size, copperType, lme, withInsulation, safety);
            const baseWithIns = (VRV_BASELINE[size] + (withInsulation ? INSULATION[size] ?? 0 : 0)) * safety;
            return (
              <tr key={size} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{size}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#777' }}>{fmt(baseWithIns)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: clr(r.delta) }}>
                  {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmt(r.ins)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(r.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VRVBlendedView({ lme, safety, cfOverrides }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#343a40', color: '#fff' }}>
            {['System Size', 'Baseline $/ft', 'Adjusted $/ft', 'Delta'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === 'System Size' ? 'left' : 'right', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TONNAGES.map((ton, i) => {
            const r = calcVRVBlended(ton, lme, safety, cfOverrides[ton]);
            return (
              <tr key={ton} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{ton === 0 ? 'Base' : `${ton}T`}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#777' }}>{fmt(r.base)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(r.adjusted)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: clr(r.delta) }}>
                  {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
        * VRV blended rate = composite of all pipe sizes for that system tonnage
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────

export default function CopperPricingCalculator() {
  // ── USER PARAMETERS ──────────────────────────────────────
  const [lme, setLme]       = useState(4.25);
  const [copperType, setCopperType] = useState('L');

  const [safetyFactors, setSafetyFactors] = useState({
    split:       1.10,
    wallMounted: 1.10,
    vrv:         1.15,
    ahuWithCU:   1.15,
  });

  // Advanced: per-tonnage copper fraction overrides (null = use default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfOverrides, setCfOverrides] = useState({
    split:       { 0: null, 5: null, 10: null, 20: null, 50: null, 75: null },
    wallMounted: { 0: null, 5: null, 10: null, 20: null, 50: null, 75: null },
    ahuWithCU:   { 0: null, 5: null, 10: null, 20: null, 50: null, 75: null },
    vrv:         { 0: null, 5: null, 10: null, 20: null, 50: null, 75: null },
  });

  // VRV sub-options
  const [withInsulation, setWithInsulation] = useState(true);
  const [activeTab, setActiveTab]           = useState('split');

  const lmeInfo = useMemo(() => {
    const ratio = lme / BASELINE_LME;
    return {
      ratio:         +ratio.toFixed(4),
      pctChange:     +((ratio - 1) * 100).toFixed(1),
      delta:         +(lme - BASELINE_LME).toFixed(2),
    };
  }, [lme]);

  const setSafety = useCallback((key, val) => {
    setSafetyFactors(prev => ({ ...prev, [key]: val }));
  }, []);

  const setCF = useCallback((equipType, ton, val) => {
    setCfOverrides(prev => ({
      ...prev,
      [equipType]: { ...prev[equipType], [ton]: val === '' ? null : parseFloat(val) },
    }));
  }, []);

  const TABS = [
    { key: 'split',       label: 'Split Systems'    },
    { key: 'wallMounted', label: 'Wall Mounted'      },
    { key: 'vrv',         label: 'VRV'               },
    { key: 'ahuWithCU',   label: 'AHU with CU'       },
  ];

  // ── STYLES ────────────────────────────────────────────────
  const S = {
    wrapper: { fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", maxWidth: 1100, margin: '0 auto', padding: '20px 16px', color: '#212529' },
    header:  { background: 'linear-gradient(135deg,#1a3a5c,#2962a8)', color: '#fff', borderRadius: 10, padding: '20px 24px', marginBottom: 20 },
    row:     { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    col:     { flex: '1 1 200px' },
    lmeBanner: {
      background: lmeInfo.pctChange === 0 ? '#e8f4fd' : lmeInfo.pctChange > 0 ? '#fce8e8' : '#e8f8e8',
      border: `1px solid ${lmeInfo.pctChange === 0 ? '#bee3f8' : lmeInfo.pctChange > 0 ? '#f5c6c6' : '#c6e6c6'}`,
      borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16,
    },
    tabBar:  { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #dee2e6' },
    tab:     (active) => ({
      padding: '8px 18px', cursor: 'pointer', border: 'none', borderRadius: '6px 6px 0 0',
      fontSize: 13, fontWeight: active ? 700 : 400,
      background: active ? '#2962a8' : 'transparent', color: active ? '#fff' : '#495057',
    }),
    sectionTitle: { fontSize: 14, fontWeight: 700, color: '#343a40', marginBottom: 10, marginTop: 0 },
  };

  return (
    <div style={S.wrapper}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Copper Pricing Calculator</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>
          LME-dynamic pricing for Split, Wall-Mount, VRV, and AHU copper refrigerant lines.
          Baseline: ${BASELINE_LME}/lb LME · Grainger ACR tube (−10% trade)
        </p>
      </div>

      {/* ── PARAMETER PANEL ───────────────────────────────── */}
      <div style={S.row}>

        {/* Param 1: LME Price */}
        <div style={{ flex: '0 0 220px' }}>
          <ParamCard>
            <Label>① LME Copper Price ($/lb)</Label>
            <NumInput value={lme} onChange={setLme} min={1} max={15} step={0.05} />
            <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
              Baseline: ${BASELINE_LME}/lb · Current LME ≈ check London Metal Exchange
            </p>
          </ParamCard>
        </div>

        {/* Param 2: Safety Factors */}
        <div style={{ flex: '1 1 320px' }}>
          <ParamCard>
            <Label>② Safety Factor per Equipment Type (contingency multiplier)</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(safetyFactors).map(([key, val]) => (
                <div key={key} style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: '#6c757d', marginBottom: 3 }}>
                    {{ split: 'Split', wallMounted: 'Wall Mount', vrv: 'VRV', ahuWithCU: 'AHU + CU' }[key]}
                  </div>
                  <NumInput value={val} onChange={v => setSafety(key, v)} min={1.00} max={2.00} step={0.01} />
                </div>
              ))}
            </div>
          </ParamCard>
        </div>

        {/* Param 3: Copper Type */}
        <div style={{ flex: '0 0 160px' }}>
          <ParamCard>
            <Label>③ Copper Type</Label>
            <Select
              value={copperType} onChange={setCopperType}
              options={[
                { value: 'L', label: 'Type L (standard)' },
                { value: 'K', label: 'Type K (heavy wall)' },
                { value: 'M', label: 'Type M (light wall)' },
              ]}
            />
            <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
              Affects weight/ft and price. L is default for HVAC.
            </p>
          </ParamCard>
        </div>
      </div>

      {/* ── LME STATUS BANNER ────────────────────────────── */}
      <div style={S.lmeBanner}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>${lme.toFixed(2)}/lb</div>
          <div style={{ fontSize: 12, color: '#555' }}>Current LME input</div>
        </div>
        <div style={{ fontSize: 22, color: clr(lmeInfo.pctChange) }}>
          {lmeInfo.pctChange > 0 ? '▲' : lmeInfo.pctChange < 0 ? '▼' : '●'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: clr(lmeInfo.pctChange) }}>
            {lmeInfo.pctChange > 0 ? '+' : ''}{lmeInfo.pctChange}% vs baseline
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>Δ = {lmeInfo.delta >= 0 ? '+' : ''}${lmeInfo.delta}/lb vs ${BASELINE_LME} baseline</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          Prices scale by copper fraction only.<br />
          Labour &amp; fixed costs unchanged.
        </div>
      </div>

      {/* ── ADVANCED: Copper Fraction Overrides ───────────── */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ background: 'none', border: '1px solid #adb5bd', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: '#6c757d' }}
        >
          {showAdvanced ? '▲ Hide' : '▼ Show'} Advanced: Copper Fraction Overrides
        </button>
        {showAdvanced && (
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 8, padding: 16, marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#6c757d', margin: '0 0 12px' }}>
              Copper fraction = share of installed price that scales with LME.
              Leave blank to use calibrated defaults (derived from baseline table).
            </p>
            {['split', 'wallMounted', 'ahuWithCU', 'vrv'].map(equip => (
              <div key={equip} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#495057', marginBottom: 6 }}>
                  {{ split: 'Split', wallMounted: 'Wall Mounted', ahuWithCU: 'AHU + CU', vrv: 'VRV Blended' }[equip]}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TONNAGES.map(ton => (
                    <div key={ton} style={{ flex: '0 0 90px' }}>
                      <div style={{ fontSize: 11, color: '#777', marginBottom: 2 }}>{ton === 0 ? 'Base' : `${ton}T`}</div>
                      <input
                        type="number" min={0} max={1} step={0.01}
                        placeholder={(COPPER_FRACTIONS[equip]?.[ton] ?? 0.45).toFixed(2)}
                        value={cfOverrides[equip][ton] ?? ''}
                        onChange={e => setCF(equip, ton, e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RESULTS TABS ──────────────────────────────────── */}
      <div>
        <div style={S.tabBar}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Split Systems */}
        {activeTab === 'split' && (
          <div>
            <p style={S.sectionTitle}>Split Systems — Installed Cost (copper pipe + labour + startup)</p>
            <LumpSumView
              equipType="split" lme={lme}
              safetyFactors={safetyFactors} copperType={copperType}
              cfOverrides={cfOverrides.split}
            />
          </div>
        )}

        {/* Wall Mounted */}
        {activeTab === 'wallMounted' && (
          <div>
            <p style={S.sectionTitle}>Wall Mounted Split — Installed Cost</p>
            <LumpSumView
              equipType="wallMounted" lme={lme}
              safetyFactors={safetyFactors} copperType={copperType}
              cfOverrides={cfOverrides.wallMounted}
            />
          </div>
        )}

        {/* VRV */}
        {activeTab === 'vrv' && (
          <div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>VRV Copper Pipe Pricing</p>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={withInsulation} onChange={e => setWithInsulation(e.target.checked)} />
                Include insulation
              </label>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, color: '#343a40', marginBottom: 8 }}>Per Pipe Size ($/ft)</p>
            <VRVPipeSizeView lme={lme} copperType={copperType} withInsulation={withInsulation} safety={safetyFactors.vrv} />

            <p style={{ fontSize: 13, fontWeight: 600, color: '#343a40', margin: '20px 0 8px' }}>Blended System Rate ($/ft of main run)</p>
            <VRVBlendedView lme={lme} safety={safetyFactors.vrv} cfOverrides={cfOverrides.vrv} />

            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '10px 14px', marginTop: 12, fontSize: 12 }}>
              <strong>VRV Refrigerant Supplemental:</strong> R454 charge ≈ $0.92/ft-ton — fixed, not copper-linked.
              38 lbs refrigerant / 6 tons / 40 ft avg run (Virtue estimate).
            </div>
          </div>
        )}

        {/* AHU with CU */}
        {activeTab === 'ahuWithCU' && (
          <div>
            <p style={S.sectionTitle}>AHU with Condensing Unit — Installed Copper Cost</p>
            <LumpSumView
              equipType="ahuWithCU" lme={lme}
              safetyFactors={safetyFactors} copperType={copperType}
              cfOverrides={cfOverrides.ahuWithCU}
            />
          </div>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <div style={{ marginTop: 24, padding: '12px 16px', background: '#f1f3f5', borderRadius: 8, fontSize: 11, color: '#6c757d', lineHeight: 1.7 }}>
        <strong>Methodology:</strong> Baseline prices calibrated from Grainger ACR copper tube (−10% trade discount) at LME $4.25/lb.
        Formula: <code>new_price = baseline × [1 + copper_fraction × (LME/4.25 − 1)] × safety_factor</code>.
        VRV per-size uses physically exact: <code>Δ$/ft = weight_lb/ft × ΔLME</code>.
        Labour, fittings, refrigerant charge are fixed components not linked to LME.
      </div>
    </div>
  );
}
