/**
 * ductCalculations.js — DISPLAY HELPERS ONLY
 *
 * This file contains only the lightweight, UI-only helpers used by DuctRow.jsx
 * and PriceSettings.jsx for live previews (gauge badge, shape label, surface
 * area hint, thickness, material reference table).
 *
 * ALL cost calculations (material, labor, totals, incidentals, etc.) have been
 * moved to the backend:  backend/engine/ductCalculationEngine.js
 * They are called via:   POST /api/calculate  { module: 'METAL_DUCT', rows, settings }
 *
 * Do NOT add cost math here — the server is the single source of truth.
 */

// ─── DUCT MATERIAL OPTIONS ────────────────────────────────────────────────────
// Used by DuctRow material dropdown and PriceSettings per-material table.
export const DUCT_MATERIAL_OPTIONS = [
  { value: 'galvanized',   label: 'Galvanized Steel',  short: 'Galv.' },
  { value: 'blackSteel',   label: 'Black Steel',        short: 'Black' },
  { value: 'stainless304', label: 'Stainless 304',      short: 'SS304' },
  { value: 'stainless316', label: 'Stainless 316',      short: 'SS316' },
  { value: 'aluminum',     label: 'Aluminum 3003',      short: 'Alum.' },
];

// ─── GAUGE THICKNESS BY MATERIAL (mm) ────────────────────────────────────────
// Used to display the thickness badge in DuctRow and the reference table in
// PriceSettings. Display only — not for cost calculations.
// Sources: ASTM A653 (galvanized), A568 (black steel), A240 (SS), B209 (aluminum)
export const GAUGE_THICKNESS_MM = {
  galvanized:   { 18: 1.310, 20: 1.006, 22: 0.853, 24: 0.701, 26: 0.551, 28: 0.475, 30: 0.399 },
  blackSteel:   { 18: 1.214, 20: 0.912, 22: 0.759, 24: 0.607, 26: 0.455, 28: 0.378, 30: 0.305 },
  stainless304: { 18: 1.270, 20: 0.953, 22: 0.795, 24: 0.635, 26: 0.478, 28: 0.396 },
  stainless316: { 18: 1.270, 20: 0.953, 22: 0.795, 24: 0.635, 26: 0.478, 28: 0.396 },
  aluminum:     { 18: 1.024, 20: 0.813, 22: 0.643, 24: 0.511, 26: 0.404, 28: 0.320 },
};

// ─── MATERIAL DENSITY (kg/m³) ─────────────────────────────────────────────────
// Used only in PriceSettings to display the reference table. Display only.
export const MATERIAL_DENSITY_KG_M3 = {
  galvanized:   7850,
  blackSteel:   7850,
  stainless304: 7930,
  stainless316: 8030,
  aluminum:     2730,
};

// ─── SHAPE DETECTION ──────────────────────────────────────────────────────────
// Shows "⬛ Rect" / "⭕ Round" label beneath the size input in DuctRow.
export function detectShape(sizeString) {
  if (!sizeString) return null;
  return sizeString.includes('x') || sizeString.includes('X') || sizeString.includes('*')
    ? 'rectangular'
    : 'round';
}

// ─── SIZE PARSER ──────────────────────────────────────────────────────────────
export function parseSize(sizeString) {
  if (!sizeString) return null;
  const s = sizeString.trim().toLowerCase();
  if (!s.includes('x') && !s.includes('*')) {
    const d = parseFloat(s);
    if (!isNaN(d)) return { type: 'round', diameter: d };
  }
  const parts = s.split(/[x*]/);
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!isNaN(w) && !isNaN(h)) return { type: 'rectangular', width: w, height: h };
  }
  return null;
}

// ─── MAX DIMENSION ────────────────────────────────────────────────────────────
// Used for gauge preview badge in DuctRow.
export function getMaxDimension(sizeString) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;
  if (parsed.type === 'round') return parsed.diameter;
  return Math.max(parsed.width, parsed.height);
}

// ─── GAUGE SELECTION ─────────────────────────────────────────────────────────
// Shows the SMACNA gauge badge live as the user types — no cost computed here.
// Source: SMACNA HVAC Duct Construction Standards 4th Ed., 1" WG
export function selectGauge(maxDimension, shape = 'rectangular') {
  const d = Number(maxDimension);
  if (shape === 'round') {
    if (d <=  8) return 26;
    if (d <= 14) return 24;
    if (d <= 26) return 22;
    if (d <= 50) return 20;
    return 18;
  }
  if (d <= 12) return 26;
  if (d <= 30) return 24;
  if (d <= 42) return 22;
  if (d <= 60) return 20;
  return 18;
}

// ─── THICKNESS LOOKUP ─────────────────────────────────────────────────────────
// Shows "X.XXX mm" beneath the gauge badge in DuctRow.
export function getThicknessMm(gauge, ductMaterial = 'galvanized') {
  const table = GAUGE_THICKNESS_MM[ductMaterial] || GAUGE_THICKNESS_MM.galvanized;
  return table[gauge] || null;
}

// ─── SURFACE AREA PREVIEW ─────────────────────────────────────────────────────
// Shows a live "XX.X sqft" hint in DuctRow before the user clicks Calculate.
// The authoritative value is computed by the backend engine.
export function calculateSurfaceArea(sizeString, linearFeet) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;
  const lf = Number(linearFeet) || 0;
  if (parsed.type === 'round') {
    return (Math.PI * parsed.diameter * lf * 12) / 144;
  }
  if (parsed.type === 'rectangular') {
    return (2 * (parsed.width + parsed.height) * lf * 12) / 144;
  }
  return 0;
}
