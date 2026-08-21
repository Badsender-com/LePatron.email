#!/usr/bin/env node
'use strict';

/**
 * Migration: normalise Expertise.scope (trim + lowercase, deduped, sorted).
 *
 * Scopes are free text on both sides of a strict string equality: an admin
 * types one in the UI, a developer hardcodes the same word in a findApplicable
 * call. `CTA` never met `cta`, and the mismatch was silent (cf. review R2).
 * Both sides now go through services/expertise-scope.js — this aligns the rows
 * written before that.
 *
 * Required, not optional: without it an expertise tagged `CTA` stops matching
 * entirely, since the read side normalises to `cta`.
 *
 * Only documents whose scope actually differs are written, so re-running is a
 * no-op. Reported per expertise so a collision (two scopes collapsing into one,
 * e.g. `CTA` + `cta`) is visible rather than silent.
 *
 * Usage:
 *   node scripts/migrate-expertise-scope-normalize.js              # apply
 *   node scripts/migrate-expertise-scope-normalize.js --dry-run    # report
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
const { Expertises } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));
const { normalizeScopes } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'ai-skill',
  'services',
  'expertise-scope.js'
));

const DRY = process.argv.includes('--dry-run');

/**
 * Pure planning step (unit-testable). Returns the normalised scope to write, or
 * null when the document is already canonical.
 *
 * @returns {{ scope: string[], collapsed: boolean }|null}
 */
function planScopeMigration(doc) {
  const current = Array.isArray(doc.scope) ? doc.scope : [];
  const next = normalizeScopes(current);
  const unchanged =
    current.length === next.length && current.every((v, i) => v === next[i]);
  if (unchanged) return null;
  return { scope: next, collapsed: next.length < current.length };
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const docs = await Expertises.find({}, { expertiseId: 1, scope: 1 }).lean();

    let migrated = 0;
    for (const doc of docs) {
      const plan = planScopeMigration(doc);
      if (!plan) continue;
      migrated += 1;
      const note = plan.collapsed ? ' (duplicates collapsed)' : '';
      console.log(
        `${DRY ? '[dry] ' : ''}${doc.expertiseId}: ${JSON.stringify(
          doc.scope
        )} → ${JSON.stringify(plan.scope)}${note}`
      );
      if (DRY) continue;
      await Expertises.collection.updateOne(
        { _id: doc._id },
        { $set: { scope: plan.scope } }
      );
    }

    console.log(
      `Expertise scope normalisation: ${migrated} expertise(s) ${
        DRY ? 'would be updated' : 'updated'
      }, ${docs.length - migrated} already canonical.`
    );
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

module.exports = { planScopeMigration };
