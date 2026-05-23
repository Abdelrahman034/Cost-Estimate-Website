/**
 * Analytics Route — /api/analytics
 * Powers the Admin Analytics Dashboard with aggregated project data.
 */
const express = require('express');
const router  = express.Router();
const { getDB } = require('../services/data/dbService');

// Helper: parse location into a normalized city/area label
function normalizeArea(location) {
  if (!location) return 'Unknown';
  const loc = location.trim().toLowerCase();

  // Common Texas metros
  if (loc.includes('san antonio') || loc.includes('san ant')) return 'San Antonio';
  if (loc.includes('houston'))   return 'Houston';
  if (loc.includes('dallas'))    return 'Dallas';
  if (loc.includes('austin'))    return 'Austin';
  if (loc.includes('fort worth') || loc.includes('ft worth') || loc.includes('ft. worth')) return 'Fort Worth';
  if (loc.includes('el paso'))   return 'El Paso';
  if (loc.includes('corpus'))    return 'Corpus Christi';
  if (loc.includes('lubbock'))   return 'Lubbock';
  if (loc.includes('laredo'))    return 'Laredo';
  if (loc.includes('irving'))    return 'Irving';
  if (loc.includes('arlington')) return 'Arlington';
  if (loc.includes('plano'))     return 'Plano';

  // Return first segment (city) from "City, State" format
  const parts = location.split(/[,\-|]/);
  return parts[0].trim() || location.trim();
}

// Helper: format month label from ISO date string
function monthLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

// GET /api/analytics  — full dashboard payload
router.get('/', (req, res) => {
  try {
    const db = getDB();

    // ── 1. All projects with estimate counts and proposal totals ──
    const projects = db.prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM estimates e WHERE e.project_id = p.id) AS estimate_count,
        (SELECT MAX(pr.total_bid) FROM proposals pr WHERE pr.project_id = p.id) AS latest_bid,
        (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS proposal_count
      FROM projects p
      ORDER BY p.created_at DESC
    `).all();

    // ── 2. All estimates (for module usage + direct cost totals) ──
    const allEstimates = db.prepare(`
      SELECT project_id, module, totals_json FROM estimates
    `).all();

    // Parse estimate totals per project
    const estimateTotalsByProject = {};
    const moduleUsage = {};

    for (const est of allEstimates) {
      let totals = {};
      try { totals = JSON.parse(est.totals_json || '{}'); } catch {}

      // Module usage count
      moduleUsage[est.module] = (moduleUsage[est.module] || 0) + 1;

      // Sum up direct costs per project
      if (!estimateTotalsByProject[est.project_id]) {
        estimateTotalsByProject[est.project_id] = { material: 0, labor: 0, total: 0 };
      }
      const m = parseFloat(totals.totalMaterial || totals.material || 0);
      const l = parseFloat(totals.totalLabor    || totals.labor    || 0);
      const t = parseFloat(totals.totalCost     || totals.total    || m + l);
      estimateTotalsByProject[est.project_id].material += m;
      estimateTotalsByProject[est.project_id].labor    += l;
      estimateTotalsByProject[est.project_id].total    += t;
    }

    // ── 3. Enrich projects ──
    let totalBidValue    = 0;
    let totalDirectCost  = 0;
    let marginSum        = 0;
    let marginCount      = 0;

    const enriched = projects.map(p => {
      const area      = normalizeArea(p.location);
      const gc        = (p.gc || '').trim() || 'Unknown GC';
      const bidValue  = parseFloat(p.latest_bid || 0);
      const estTotals = estimateTotalsByProject[p.id] || { material: 0, labor: 0, total: 0 };
      const directCost = estTotals.total;

      // Margin: (bid - direct) / bid  — only if both exist
      let margin = null;
      if (bidValue > 0 && directCost > 0) {
        margin = ((bidValue - directCost) / bidValue) * 100;
        marginSum += margin;
        marginCount++;
      }

      if (bidValue > 0) totalBidValue   += bidValue;
      if (directCost > 0) totalDirectCost += directCost;

      return {
        id:           p.id,
        name:         p.name,
        location:     p.location || '',
        area,
        gc,
        bidDate:      p.bid_date  || '',
        createdAt:    p.created_at,
        updatedAt:    p.updated_at,
        estimateCount: p.estimate_count,
        proposalCount: p.proposal_count,
        bidValue,
        directCost,
        margin,
        material:  estTotals.material,
        labor:     estTotals.labor,
      };
    });

    // ── 4. KPI summary ──
    const avgBid    = enriched.filter(p => p.bidValue > 0).length > 0
      ? totalBidValue / enriched.filter(p => p.bidValue > 0).length
      : 0;
    const avgMargin = marginCount > 0 ? marginSum / marginCount : null;

    // ── 5. Submissions by month (last 24 months) ──
    const now = new Date();
    const monthMap = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      monthMap[key] = { month: key, count: 0, value: 0, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) };
    }
    for (const p of enriched) {
      const key = monthLabel(p.createdAt);
      if (key && monthMap[key]) {
        monthMap[key].count++;
        monthMap[key].value += p.bidValue;
      }
    }
    const submissionsByMonth = Object.values(monthMap);

    // ── 6. By area ──
    const areaMap = {};
    for (const p of enriched) {
      if (!areaMap[p.area]) areaMap[p.area] = { area: p.area, count: 0, value: 0, marginSum: 0, marginCount: 0 };
      areaMap[p.area].count++;
      areaMap[p.area].value += p.bidValue;
      if (p.margin !== null) {
        areaMap[p.area].marginSum   += p.margin;
        areaMap[p.area].marginCount++;
      }
    }
    const byArea = Object.values(areaMap)
      .map(a => ({
        area:      a.area,
        count:     a.count,
        value:     a.value,
        avgMargin: a.marginCount > 0 ? a.marginSum / a.marginCount : null,
      }))
      .sort((a, b) => b.count - a.count);

    // ── 7. Top 10 GCs ──
    const gcMap = {};
    for (const p of enriched) {
      if (!gcMap[p.gc]) gcMap[p.gc] = { gc: p.gc, count: 0, value: 0, projects: [] };
      gcMap[p.gc].count++;
      gcMap[p.gc].value += p.bidValue;
      gcMap[p.gc].projects.push(p.name);
    }
    const topGCs = Object.values(gcMap)
      .sort((a, b) => b.count - a.count || b.value - a.value)
      .slice(0, 10);

    // ── 8. Bid value distribution (buckets) ──
    const buckets = [
      { label: '<$50K',     min: 0,       max: 50000,   count: 0, value: 0 },
      { label: '$50-100K',  min: 50000,   max: 100000,  count: 0, value: 0 },
      { label: '$100-250K', min: 100000,  max: 250000,  count: 0, value: 0 },
      { label: '$250-500K', min: 250000,  max: 500000,  count: 0, value: 0 },
      { label: '$500K-$1M', min: 500000,  max: 1000000, count: 0, value: 0 },
      { label: '>$1M',      min: 1000000, max: Infinity, count: 0, value: 0 },
    ];
    for (const p of enriched) {
      if (p.bidValue <= 0) continue;
      const b = buckets.find(b => p.bidValue >= b.min && p.bidValue < b.max);
      if (b) { b.count++; b.value += p.bidValue; }
    }

    // ── 9. Module usage sorted ──
    const moduleUsageArr = Object.entries(moduleUsage)
      .map(([module, count]) => ({ module: module.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count }))
      .sort((a, b) => b.count - a.count);

    // ── 10. Recent projects (last 10) ──
    const recentProjects = enriched.slice(0, 10).map(p => ({
      id:           p.id,
      name:         p.name,
      area:         p.area,
      gc:           p.gc,
      bidDate:      p.bidDate,
      createdAt:    p.createdAt,
      bidValue:     p.bidValue,
      margin:       p.margin,
      estimateCount: p.estimateCount,
    }));

    // ── 11. Pipeline value (projects without a final proposal) ──
    const pipelineProjects = enriched.filter(p => p.proposalCount === 0 && p.estimateCount > 0);
    const pipelineValue    = pipelineProjects.reduce((s, p) => s + p.directCost, 0);

    res.json({
      kpis: {
        totalProjects:    enriched.length,
        totalBidValue,
        avgBid,
        avgMargin,
        totalDirectCost,
        activeGCs:        Object.keys(gcMap).filter(g => g !== 'Unknown GC').length,
        pipelineCount:    pipelineProjects.length,
        pipelineValue,
        proposalsSent:    enriched.filter(p => p.proposalCount > 0).length,
      },
      submissionsByMonth,
      byArea,
      topGCs,
      bidDistribution: buckets,
      moduleUsage: moduleUsageArr,
      recentProjects,
      allProjects: enriched,
    });
  } catch (err) {
    console.error('[analytics]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
