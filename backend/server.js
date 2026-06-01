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
const calculateRoutes     = require('./features/calculate/calculateRoutes');
const copperRoutes        = require('./features/copper/copperRoutes');
const copperDataLoader    = require('./features/copper/copperDataLoader');
const modulesRoutes       = require('./features/modules/modulesRoutes');
const modulesController   = require('./features/modules/modulesController');

const { requireAuth }     = require('./middleware/auth');
const {
  securityHeaders,
  authLimiter,
  apiLimiter,
  hpp,
  sanitizeBody,
  jsonbGuard,
} = require('./middleware/security');

// Legacy route modules
const pricesLegacyRoutes  = require('./routes/prices');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(securityHeaders);

// ── HTTP Parameter Pollution protection ──────────────────────────────────────
app.use(hpp);

// ── Body parsing — tightened to 10mb ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Input sanitization (XSS + null bytes) ────────────────────────────────────
app.use(sanitizeBody);

// ── JSONB depth/size guard ────────────────────────────────────────────────────
app.use(jsonbGuard);

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ── General API rate limit (300 req/min per IP) ───────────────────────────────
app.use('/api', apiLimiter);

// ── Auth routes with strict rate limit (10 attempts / 15 min per IP) ─────────
app.use('/api/auth', authLimiter, authRoutes);

// ── Application routes ────────────────────────────────────────────────────────
app.use('/api/company',                         companyRoutes);
app.use('/api/projects',                        projectsRoutes);
app.use('/api/projects/:projectId/estimates',   estimatesRoutes);
app.use('/api/projects/:projectId/scenarios',   scenariosRoutes);
app.use('/api/projects/:projectId',             projectSubRoutes);
app.use('/api/suppliers',                       suppliersRoutes);
app.use('/api/pricing',                         pricingRoutes);
app.use('/api/analytics',                       analyticsRoutes);
app.use('/api/calculate',                       calculateRoutes);
app.use('/api/copper-pricing',                  copperRoutes);

// ── Isolated module row tables ────────────────────────────────────────────────
app.use(
  '/api/projects/:projectId/estimates/:estimateId/rows/:module',
  modulesRoutes,
);
app.get('/api/modules', requireAuth, modulesController.listRegistered);

// ── Legacy routes ─────────────────────────────────────────────────────────────
app.use('/api/prices', requireAuth, pricesLegacyRoutes);

// ── Health check — scrubbed in production ─────────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ status: 'OK' });
  }
  let db = 'unknown';
  try { await prisma.$queryRaw`SELECT 1`; db = 'connected'; } catch { db = 'unreachable'; }
  res.json({ status: 'OK', db, timestamp: new Date() });
});

// ── Global error handler — never leak stack traces to clients ─────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  const status  = err.status || 500;
  const message = status < 500 ? err.message : 'An internal error occurred.';
  res.status(status).json({ error: message });
});

process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`\nHVAC Estimator API  ->  http://localhost:${PORT}`);
  console.log(`Health check        ->  http://localhost:${PORT}/api/health\n`);
  copperDataLoader.init().catch(err =>
    console.warn('[startup] copperDataLoader.init() failed silently:', err.message),
  );
});
