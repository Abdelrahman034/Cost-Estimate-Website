const { PrismaClient } = require('@prisma/client');

// A single shared Prisma instance for the entire backend.
// Node's require() cache means this file is only executed once,
// so we always get back the same PrismaClient object.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
