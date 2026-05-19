const projectsRouter = require('./projects');
const pricesRouter = require('./prices');
const drawingsRouter = require('./drawings');
const emailsRouter = require('./emails');
const proposalsRouter = require('./proposals');
const suppliersRouter = require('./suppliers');

function registerRoutes(app) {
  app.use('/api/projects', projectsRouter);
  app.use('/api/prices', pricesRouter);
  app.use('/api/drawings', drawingsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/proposals', proposalsRouter);
  app.use('/api/suppliers', suppliersRouter);
}

module.exports = { registerRoutes };
