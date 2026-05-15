const fs = require('fs');
const path = require('path');
const vm = require('vm');
const xlsx = require('xlsx');

function extractConst(source, name) {
  const re = new RegExp(`${name}\s*=\s*([\s\S]*?);\n`);
  const match = source.match(re);
  if (!match) return null;
  const rhs = match[1];
  try {
    // Evaluate the RHS in a safe context
    const ctx = {};
    vm.createContext(ctx);
    const script = new vm.Script(`result = ${rhs}`);
    script.runInContext(ctx);
    return ctx.result;
  } catch (err) {
    return null;
  }
}

function extractExportedArray(source, exportName) {
  const re = new RegExp(`export const ${exportName}\s*=\s*([\\s\\S]*?\]);`);
  const m = source.match(re);
  if (!m) return null;
  try {
    const ctx = {};
    vm.createContext(ctx);
    const script = new vm.Script(`result = ${m[1]}`);
    script.runInContext(ctx);
    return ctx.result;
  } catch (err) {
    return null;
  }
}

function findRoundPriceTableFromSheet(sheetRows) {
  // Look for columns where first col is integer sizes and second is decimal rates
  const candidates = [];
  for (let r = 0; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    if (!row) continue;
    for (let c = 0; c < row.length - 1; c++) {
      const a = row[c];
      const b = row[c + 1];
      if (typeof a === 'number' && typeof b === 'number' && a >= 3 && a <= 200 && b > 0) {
        // gather downwards
        const arr = [];
        for (let rr = r; rr < Math.min(r + 40, sheetRows.length); rr++) {
          const row2 = sheetRows[rr];
          if (!row2) break;
          const v1 = row2[c];
          const v2 = row2[c + 1];
          if (typeof v1 === 'number' && typeof v2 === 'number') arr.push({ size: v1, rate: v2 });
          else break;
        }
        if (arr.length >= 5) candidates.push(arr);
      }
    }
  }
  // return longest candidate
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || null;
}

function compareArrays(jsArr, excelArr) {
  const map = {};
  excelArr.forEach((e) => { map[Number(e.size)] = Number(e.rate); });
  const diffs = [];
  jsArr.forEach((j) => {
    const size = Number(j.size);
    const rate = Number(j.rate);
    const x = map[size];
    if (x === undefined) diffs.push({ size, rate, excel: null });
    else if (Math.abs(x - rate) > 1e-6) diffs.push({ size, rate, excel: x });
  });
  return diffs;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const utilsPath = path.join(repoRoot, 'frontend', 'src', 'utils', 'ductCalculations.js');
  if (!fs.existsSync(utilsPath)) {
    console.error('Cannot find ductCalculations.js at', utilsPath);
    process.exit(1);
  }
  const src = fs.readFileSync(utilsPath, 'utf8');

  const ROUND = extractExportedArray(src, 'ROUND_DUCT_PRICE_PER_FT');
  const WEIGHT = extractConst(src, 'WEIGHT_PER_AREA_BY_GAUGE');
  const LABOR = extractConst(src, 'LABOR_FACTOR_BY_GAUGE');
  const SHEET_COST = extractConst(src, 'SHEET_METAL_COST_PER_LB');

  console.log('Extracted from JS:');
  console.log('ROUND table entries:', ROUND ? ROUND.length : 'not found');
  console.log('WEIGHT keys:', WEIGHT ? Object.keys(WEIGHT) : 'not found');
  console.log('LABOR keys:', LABOR ? Object.keys(LABOR) : 'not found');
  console.log('SHEET_METAL_COST_PER_LB:', SHEET_COST);

  // open workbook
  const xlsxPath = path.join(repoRoot, 'Bid_Template_Commercial_v2.6.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error('Workbook not found at', xlsxPath);
    process.exit(2);
  }
  const wb = xlsx.readFile(xlsxPath);
  console.log('Workbook sheets:', wb.SheetNames.join(', '));

  // Try to find sheet with 'Metal' in name
  const metalSheetName = wb.SheetNames.find((n) => /metal/i.test(n)) || wb.SheetNames[0];
  console.log('Using sheet:', metalSheetName);
  const sheet = wb.Sheets[metalSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const excelRound = findRoundPriceTableFromSheet(rows);
  if (!excelRound) {
    console.log('Could not locate round duct price table automatically in sheet.');
  } else {
    console.log('Found candidate round duct table with', excelRound.length, 'rows.');
    const diffs = compareArrays(ROUND || [], excelRound);
    if (diffs.length === 0) console.log('ROUND table matches Excel table (sizes present and rates equal).');
    else console.log('Differences found in ROUND table:', diffs);
  }

  // As a fallback, print a few rows from the sheet around where numeric tables were found
  console.log('\nSample numeric rows from sheet (first 20 rows):');
  for (let i = 0; i < Math.min(20, rows.length); i++) console.log(i + ':', rows[i]);
}

main();
