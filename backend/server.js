require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const prisma              = require('./prisma/client');
const authRoutes          = require('./features/auth/authRoutes');
const projectsRoutes      = require('./features/projects/projectsRoutes');
const estimatesRoutes     = require('./features/estimates/estimatesRoutes');
const projectSubRoutes    = require('./features/projects/projectSubRoutes');
const scenariosRoutes     = require('./features/scenarios/scenariosRoutes');
const suppliersRoutes     = require('./features/suppliers/suppliersRoutes');
const pricingRoutes       = require('./features/pricing/pricingRoutes');
const analyticsRoutes     = require('./features/analytics/analyticsRoutes');
const companyRoutes       = require('./features/company/companyRoutes');
const calculateRoutes      = require('./features/calculate/calculateRoutes');
const copperRoutes         = require('./features/copper/copperRoutes');
const copperDataLoader     = require('./features/copper/copperDataLoader');

// ── Legacy route modules (prices, drawings, emails, proposals) ────────────────
const { requireAuth }      = require('./middleware/auth');
const pricesLegacyRoutes   = require('./routes/prices');
const drawingsRoutes        = require('./routes/drawings');
const emailsRoutes          = require('./routes/emails');
const proposalsRoutes       = require('./routes/proposals');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',                            authRoutes);
app.use('/api/company',                         companyRoutes);
app.use('/api/projects',                        projectsRoutes);
app.use('/api/projects/:projectId/estimates',   estimatesRoutes);
app.use('/api/projects/:projectId/scenarios',   scenariosRoutes);
app.use('/api/projects/:projectId',             projectSubRoutes);   // contacts, changelog, reports
app.use('/api/suppliers',                       suppliersRoutes);
app.use('/api/pricing',                         pricingRoutes);
app.use('/api/analytics',                       analyticsRoutes);
app.use('/api/calculate',                       calculateRoutes);
app.use('/api/copper-pricing',                  copperRoutes);

// ── Legacy routes (auth guard applied at mount point) ─────────────────────────
app.use('/api/prices',     requireAuth, pricesLegacyRoutes);
app.use('/api/drawings',   requireAuth, drawingsRoutes);
app.use('/api/emails',     requireAuth, emailsRoutes);
app.use('/api/proposals',  requireAuth, proposalsRoutes);

app.get('/api/health', async (req, res) => {
  let db = 'unknown';
  try { await prisma.$queryRaw`SELECT 1`; db = 'PostgreSQL connected'; } catch { db = 'unreachable'; }
  res.json({ status: 'OK', db, timestamp: new Date() });
});

process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`\nHVAC Estimator API  →  http://localhost:${PORT}`);
  console.log(`Health check        →  http://localhost:${PORT}/api/health\n`);

  // Load copper reference tables from DB into the pricing engine.
  // Runs async — server is already accepting requests; engine falls back
  // to hardcoded constants until the DB load completes (~50 ms).
  copperDataLoader.init().catch(err =>
    console.warn('[startup] copperDataLoader.init() failed silently:', err.message),
  );
});
