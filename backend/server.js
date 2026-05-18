require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { registerRoutes } = require('./routes');

// Init SQLite DB on startup
const { getDB } = require('./services');
try {
  getDB();
  console.log('SQLite database ready (data/estimator.db)');
} catch (err) {
  console.error('Database init failed:', err.message);
}

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

registerRoutes(app);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HVAC Estimator API running',
    ai: process.env.GROQ_API_KEY ? 'Groq connected' : 'GROQ_API_KEY not set',
    db: 'SQLite (data/estimator.db)',
    timestamp: new Date(),
  });
});

app.listen(PORT, () => {
  console.log('\nHVAC Estimator Backend  ->  http://localhost:' + PORT);
  console.log('Health check            ->  http://localhost:' + PORT + '/api/health');
  console.log('AI provider             ->  Groq (free tier)');
  console.log('Database               ->  SQLite\n');
});
