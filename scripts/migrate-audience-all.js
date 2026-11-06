#!/usr/bin/env node
'use strict';

/**
 * Migration: open to every company the skills and expertises that have no
 * audience.
 *
 * ADR 0013 adds an audience to skills and expertises, and a new one starts
 * with the platform company. The ones written before were used by every
 * company: they get the audience `all`, without which no client company reads
 * them any more (services/audience.js). An audience stored as `null`, or as
 * `subscribers` (the name `all` had while the audience was being built, left
 * on some test instances), is read the same way. `platform` and `all` are left
 * as they are.
 *
 * Idempotent: re-running is a no-op.
 *
 * Usage:
 *   node scripts/migrate-audience-all.js              # apply
 *   node scripts/migrate-audience-all.js --dry-run    # report only
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const server = (...parts) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...parts);
const { Audiences } = require(server(
  'ai-skill',
  'constant',
  'skill-constants.js'
));

// The name `all` had while the audience was being built.
const FORMER_ALL = 'subscribers';
// The documents to migrate: those with no audience, a null one or the former
// name of `all` (`$in` with null matches a missing field too).
const WITHOUT_AUDIENCE = Object.freeze({
  audience: { $in: [null, FORMER_ALL] },
});

/**
 * @param {import('mongoose').Model} model the skills or the expertises
 * @param {Object} options
 * @param {boolean} options.dryRun counts without writing
 * @returns {Promise<number>} how many had no audience of `platform` or `all`
 */
async function migrate(model, { dryRun }) {
  const count = await model.countDocuments(WITHOUT_AUDIENCE);
  if (!dryRun && count) {
    // An audience given at deployment is not an edit: the date the lists
    // show as "updated on" stays the author's.
    await model.updateMany(
      WITHOUT_AUDIENCE,
      { $set: { audience: Audiences.ALL } },
      { timestamps: false }
    );
  }
  return count;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = require(server('node.config.js'));
  const { Expertises, LePatronSkills } = require(server(
    'common',
    'models.common.js'
  ));
  // The URI carries the credentials of the database: never printed.
  console.log(`Connecting to the database (dry-run=${dryRun})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    for (const [label, model] of [
      ['Expertises', Expertises],
      ['Skills', LePatronSkills],
    ]) {
      const count = await migrate(model, { dryRun });
      console.log(
        `${label}: ${count} opened to every company${dryRun ? ' (dry)' : ''}`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // Exits once done: something the models load keeps the event loop alive,
  // and a deploy step must not hang (the other migrations wait forever).
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { WITHOUT_AUDIENCE, migrate };
