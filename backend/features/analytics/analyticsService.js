// features/analytics/analyticsService.js
//
// Aggregates project + estimate data for the Admin Analytics dashboard.
// All queries are scoped to companyId.

const prisma = require('../../prisma/client');

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeArea(location) {
  if (!location) return 'Unknown';
  const loc = location.toLowerCase();
  if (loc.includes('san antonio'))                               return 'San Antonio';
  if (loc.includes('houston'))                                   return 'Houston';
  if (loc.includes('dallas'))                                    return 'Dallas';
  if (loc.includes('austin'))                                    return 'Austin';
  if (loc.includes('fort worth') || loc.includes('ft worth'))   return 'Fort Worth';
  if (loc.includes('el paso'))                                   return 'El Paso';
  if (loc.includes('corpus'))                                    return 'Corpus Christi';
  if (loc.includes('lubbock'))                                   return 'Lubbock';
  if (loc.includes('laredo'))                                    return 'Laredo';
  if (loc.includes('arlington'))                                 return 'Arlington';
  if (loc.includes('plano'))                                     return 'Plano';
  return location.split(/[,\-|]/)[0].trim() || location.trim();
}

function monthKey(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d) ? null : d.toISOString().slice(0, 7);
}

// ── Main analytics query ──────────────────────────────────────────────────────

async function getAnalytics({ companyId }) {

  // 1. Fetch all projects with their estimates and latest report (bid)
  const projects = await prisma.project.findMany({
    where:   { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      estimates: {
        select: { module: true, totalCost: true, totalMaterial: true, totalLabor: true },
      },
      reports: {
        select:  { totalBid: true },
        orderBy: { createdAt: 'desc' },
        take:    1,
      },
      _count: { select: { estimates: true, reports: true } },
    },
  });

  // 2. Enrich each project
  let totalBidValue   = 0;
  let totalDirectCost = 0;
  let marginSum       = 0;
  let marginCount     = 0;
  const moduleUsageMap = {};
  const gcMap          = {};
  const areaMap        = {};

  const enriched = projects.map(p => {
    const area      = normalizeArea(p.location);
    const gc        = (p.gc || '').trim() || 'Unknown GC';
    const bidValue  = parseFloat(p.reports[0]?.totalBid ?? 0) || 0;

    // Sum estimate totals for this project
    let directCost = 0, material = 0, labor = 0;
    for (const e of p.estimates) {
      directCost += parseFloat(e.totalCost     ?? 0) || 0;
      material   += parseFloat(e.totalMaterial ?? 0) || 0;
      labor      += parseFloat(e.totalLabor    ?? 0) || 0;
      moduleUsageMap[e.module] = (moduleUsageMap[e.module] || 0) + 1;
    }

    const margin = (bidValue > 0 && directCost > 0)
      ? ((bidValue - directCost) / bidValue) * 100
      : null;

    if (bidValue   > 0) totalBidValue   += bidValue;
    if (directCost > 0) totalDirectCost += directCost;
    if (margin !== null) { marginSum += margin; marginCount++; }

    // Accumulate GC stats
    if (!gcMap[gc]) gcMap[gc] = { gc, count: 0, value: 0, projects: [] };
    gcMap[gc].count++;
    gcMap[gc].value += bidValue;
    gcMap[gc].projects.push(p.name);

    // Accumulate area stats
    if (!areaMap[area]) areaMap[area] = { area, count: 0, value: 0, marginSum: 0, marginCount: 0 };
    areaMap[area].count++;
    areaMap[area].value += bidValue;
    if (margin !== null) { areaMap[area].marginSum += margin; areaMap[area].marginCount++; }

    return {
      id: p.id, name: p.name, location: p.location || '',
      area, gc, status: p.status,
      bidDate:   p.bidDate   ? p.bidDate.toISOString()   : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
      estimateCount: p._count.estimates,
      reportCount:   p._count.reports,
      bidValue, directCost, material, labor, margin,
    };
  });

  // 3. Submissions by month — last 24 months
  const now      = new Date();
  const monthMap = {};
  for (let i = 23; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    monthMap[key] = {
      month: key,
      count: 0,
      value: 0,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    };
  }
  for (const p of enriched) {
    const key = monthKey(p.createdAt);
    if (key && monthMap[key]) {
      monthMap[key].count++;
      monthMap[key].value += p.bidValue;
    }
  }

  // 4. By area
  const byArea = Object.values(areaMap)
    .map(a => ({
      area:      a.area,
      count:     a.count,
      value:     a.value,
      avgMargin: a.marginCount > 0 ? a.marginSum / a.marginCount : null,
    }))
    .sort((a, b) => b.count - a.count);

  // 5. Top 10 GCs
  const topGCs = Object.values(gcMap)
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, 10);

  // 6. Bid distribution buckets
  const buckets = [
    { label: '<$50K',     min: 0,       max: 50000,    count: 0, value: 0 },
    { label: '$50–100K',  min: 50000,   max: 100000,   count: 0, value: 0 },
    { label: '$100–250K', min: 100000,  max: 250000,   count: 0, value: 0 },
    { label: '$250–500K', min: 250000,  max: 500000,   count: 0, value: 0 },
    { label: '$500K–$1M', min: 500000,  max: 1000000,  count: 0, value: 0 },
    { label: '>$1M',      min: 1000000, max: Infinity, count: 0, value: 0 },
  ];
  for (const p of enriched) {
    if (p.bidValue <= 0) continue;
    const b = buckets.find(b => p.bidValue >= b.min && p.bidValue < b.max);
    if (b) { b.count++; b.value += p.bidValue; }
  }

  // 7. Module usage sorted
  const moduleUsage = Object.entries(moduleUsageMap)
    .map(([module, count]) => ({
      module: module.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // 8. Pipeline (has estimates, no report/bid yet)
  const pipeline      = enriched.filter(p => p.estimateCount > 0 && p.reportCount === 0);
  const pipelineValue = pipeline.reduce((s, p) => s + p.directCost, 0);

  // 9. KPIs
  const withBid = enriched.filter(p => p.bidValue > 0);
  const kpis = {
    totalProjects:  enriched.length,
    totalBidValue,
    avgBid:         withBid.length > 0 ? totalBidValue / withBid.length : 0,
    avgMargin:      marginCount > 0 ? marginSum / marginCount : null,
    totalDirectCost,
    activeGCs:      Object.keys(gcMap).filter(g => g !== 'Unknown GC').length,
    pipelineCount:  pipeline.length,
    pipelineValue,
    reportsSent:    enriched.filter(p => p.reportCount > 0).length,
  };

  return {
    kpis,
    submissionsByMonth: Object.values(monthMap),
    byArea,
    topGCs,
    bidDistribution: buckets,
    moduleUsage,
    recentProjects:  enriched.slice(0, 10),
    allProjects:     enriched,
  };
}

module.exports = { getAnalytics };
