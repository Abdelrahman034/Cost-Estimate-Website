import React, { createContext, useState, useEffect } from 'react';

const defaultPrices = {
  // Material measures
  sheetMetalKgPerFt2: 0.567, // kg/ft2 (informational)
  sheetMetalLbsPerFt2: 1.24967, // lbs/ft2 (informational)
  sheetMetalCostPerLb: 4.00, // $/lb
  // Insulation
  insulationPerSqFt: 1.25, // $/ft2
  ductWrapLaborPerFt: 4.0, // $/ft
  // Labor
  sheetMetalLaborPerFt: 23.0, // $/ft (sheet metal labor)
  // Flex
  flexDuctLaborShort: 40.0, // $/run
  flexDuctLaborLong: 80.0, // $/run
  maxFlexDuctLen: 5.0, // ft
  offtakeCost: 20.0, // $/run
  vdCost: 25.0, // $/run (volume damper)
  // Internal insulation uplift
  internalInsulationUplift: 0.4, // 40%
  // Incidentals (hangers, sealant, hardware, tape) as % of duct material — matches Excel header "20%"
  incidentalsPct: 0.20,
  // Round duct incidentals rate — Excel V2 = 25% (different from square duct)
  roundDuctIncidentalsPct: 0.25,
  // Measurement unit & scale factor — mirrors Excel E2 "Scale - Ft/Unit"
  // The raw value the user types is multiplied by measureScaleFactor to get actual feet.
  // Examples: 'ft' → 1.0 | 'in' → 0.0833 | 'mm' → 0.003281 | 'cm' → 0.03281
  // Users can set a custom factor (e.g. 0.003 for blueprint mm drawings).
  measureUnit: 'ft',
  measureScaleFactor: 1.0,
};

const defaultOverhead = { overheadPct: 0.15, profitPct: 0.10 };

export const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
  const [prices, setPrices] = useState(() => {
    try {
      const raw = localStorage.getItem('globalPrices');
      return raw ? JSON.parse(raw) : defaultPrices;
    } catch {
      return defaultPrices;
    }
  });

  const [overhead, setOverhead] = useState(() => {
    try {
      const raw = localStorage.getItem('globalOverhead');
      return raw ? JSON.parse(raw) : defaultOverhead;
    } catch {
      return defaultOverhead;
    }
  });

  useEffect(() => {
    try { localStorage.setItem('globalPrices', JSON.stringify(prices)); } catch {}
  }, [prices]);

  useEffect(() => {
    try { localStorage.setItem('globalOverhead', JSON.stringify(overhead)); } catch {}
  }, [overhead]);

  return (
    <SettingsContext.Provider value={{ prices, setPrices, overhead, setOverhead }}>
      {children}
    </SettingsContext.Provider>
  );
}

export default SettingsProvider;
