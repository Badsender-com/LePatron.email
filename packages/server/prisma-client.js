/**
 * Prisma Client Singleton
 *
 * Client PostgreSQL pour le module Deliverability
 * Base de données séparée de MongoDB (utilisé pour le reste de LePatron)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
});

module.exports = prisma;
