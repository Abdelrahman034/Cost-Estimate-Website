require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const prisma          = require('./prisma/client');
const authRoutes     = require('./features/auth/authRoutes');
const projectsRoutes = require('./features/projects/projectsRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectsRoutes);

app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'PostgreSQL connected';
  } catch {
    dbStatus = 'PostgreSQL unreachable';
  }

  res.json({
    status:    'OK',
    message:   'HVAC Estimator API running',
    ai:        process.env.GROQ_API_KEY ? 'Groq connected' : 'GROQ_API_KEY not set',
    db:        dbStatus,
    timestamp: new Date(),
  });
});

// Close Prisma connection cleanly when the server stops
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

app.listen(PORT, () => {
  console.log('\nHVAC Estimator Backend  ->  http://localhost:' + PORT);
  console.log('Health check            ->  http://localhost:' + PORT + '/api/health');
  console.log('AI provider             ->  Groq (free tier)');
  console.log('Database               ->  PostgreSQL (Prisma)\n');
});
