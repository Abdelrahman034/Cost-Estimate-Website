const projectsRouter = require('./projects');
const pricesRouter = require('./prices');
const drawingsRouter = require('./drawings');
const emailsRouter = require('./emails');
const proposalsRouter = require('./proposals');
const suppliersRouter = require('./suppliers');
const analyticsRouter = require('./analytics');

function registerRoutes(app) {
  app.use('/api/projects', projectsRouter);
  app.use('/api/prices', pricesRouter);
  app.use('/api/drawings', drawingsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/proposals', proposalsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/analytics', analyticsRouter);
}

module.exports = { registerRoutes };
