#!/usr/bin/env node
'use strict';

/**
 * Migration: drop two dead declarative fields removed before the AI PRs.
 *   - Expertise.consumedBySkills  (the skill↔expertise link will be derived
 *     post-v1 from manifests + invocation logs, not hand-declared)
 *   - LePatronSkill.intendedUseCases  (unused governance field)
 *
 * `$unset` on every document. Idempotent — re-running matches nothing once the
 * fields are gone (the update filter targets docs that still have the field).
 *
 * Usage:
 *   node scripts/migrate-drop-dead-ai-fields.js              # apply
 *   node scripts/migrate-drop-dead-ai-fields.js --dry-run    # report only
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const config = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'node.config.js'
));
const { Expertises, LePatronSkills } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

const TARGETS = [
  { model: Expertises, label: 'Expertise', field: 'consumedBySkills' },
  { model: LePatronSkills, label: 'LePatronSkill', field: 'intendedUseCases' },
];

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    for (const { model, label, field } of TARGETS) {
      const filter = { [field]: { $exists: true } };
      const count = await model.countDocuments(filter);
      if (DRY) {
        console.log(`[dry] ${label}.${field}: would $unset on ${count} doc(s)`);
        continue;
      }
      const res = await model.updateMany(filter, { $unset: { [field]: '' } });
      console.log(
        `${label}.${field}: $unset on ${
          res.modifiedCount || res.nModified || 0
        } doc(s)`
      );
    }
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

module.exports = { TARGETS };
