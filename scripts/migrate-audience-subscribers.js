#!/usr/bin/env node
'use strict';

/**
 * Migration: give the skills and expertises that exist an audience.
 *
 * ADR 0013 adds an audience to skills and expertises, and a new one starts
 * with the platform group. The ones written before must keep reaching every
 * subscribed group, as ADR 0012 promised: they get that audience, so the back
 * office shows what the MCP server applies. One already set is left as it is.
 *
 * Idempotent: re-running is a no-op.
 *
 * Usage:
 *   node scripts/migrate-audience-subscribers.js              # apply
 *   node scripts/migrate-audience-subscribers.js --dry-run    # report only
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const server = (...parts) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...parts);
const config = require(server('node.config.js'));
const { Expertises, LePatronSkills } = require(server(
  'common',
  'models.common.js'
));
const { Audiences } = require(server(
  'ai-skill',
  'constant',
  'skill-constants.js'
));

const DRY = process.argv.includes('--dry-run');

// The documents to migrate: those with no audience. Exported for its test.
const WITHOUT_AUDIENCE = Object.freeze({ audience: { $exists: false } });

async function migrate(model, label) {
  const count = await model.countDocuments(WITHOUT_AUDIENCE);
  if (!DRY && count) {
    await model.updateMany(WITHOUT_AUDIENCE, {
      $set: { audience: Audiences.SUBSCRIBERS },
    });
  }
  console.log(
    `${label}: ${count} opened to every subscribed group${DRY ? ' (dry)' : ''}`
  );
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await migrate(Expertises, 'Expertises');
    await migrate(LePatronSkills, 'Skills');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { WITHOUT_AUDIENCE };
