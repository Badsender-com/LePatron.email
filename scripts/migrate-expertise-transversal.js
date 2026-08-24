#!/usr/bin/env node
'use strict';

/**
 * Migration: introduce Expertise.isTransversal.
 *
 * Inverted scope semantics (cf. expertise.repository.findApplicable): an empty
 * scope no longer means "loaded everywhere". Only expertise explicitly flagged
 * isTransversal is loaded regardless of the requested scope.
 *
 * This migration flags ONLY a hard-coded allow-list of expertise ids known to
 * be intentionally transversal (today: redaction.brand-voice-defaults). It does
 * NOT auto-flag every empty-scope expertise — that would convert possible
 * oversights into transversales, exactly the accident the new semantics fix.
 * Empty-scope, non-transversal expertise are logged as a warning: they will no
 * longer be loaded by any filtered query (now visible instead of silently
 * global).
 *
 * Idempotent — re-running is a no-op.
 *
 * Usage:
 *   node scripts/migrate-expertise-transversal.js              # apply
 *   node scripts/migrate-expertise-transversal.js --dry-run    # report only
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

const DRY = process.argv.includes('--dry-run');

// Expertise intentionally loaded regardless of scope. Add ids here, never
// auto-derive from "empty scope".
const TRANSVERSAL_ALLOWLIST = ['redaction.brand-voice-defaults'];

/**
 * Pure planning step (unit-testable without a DB).
 * @param {Array<{expertiseId, scope, isTransversal}>} docs
 * @returns {{ toFlag: string[], emptyScopeWarnings: string[], alreadyOk: number }}
 */
function planTransversalMigration(docs) {
  const toFlag = [];
  const emptyScopeWarnings = [];
  let alreadyOk = 0;
  for (const doc of docs) {
    const isEmptyScope = !Array.isArray(doc.scope) || doc.scope.length === 0;
    if (TRANSVERSAL_ALLOWLIST.includes(doc.expertiseId)) {
      if (doc.isTransversal === true) alreadyOk += 1;
      else toFlag.push(doc.expertiseId);
    } else if (isEmptyScope && !doc.isTransversal) {
      // Not flagged: will no longer be loaded in filtered mode. Surface it.
      emptyScopeWarnings.push(doc.expertiseId);
    }
  }
  return { toFlag, emptyScopeWarnings, alreadyOk };
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const docs = await Expertises.find(
      {},
      { expertiseId: 1, scope: 1, isTransversal: 1 }
    ).lean();
    const { toFlag, emptyScopeWarnings, alreadyOk } = planTransversalMigration(
      docs
    );

    for (const id of toFlag) {
      if (DRY) {
        console.log(`[dry] would flag isTransversal=true on "${id}"`);
      } else {
        await Expertises.updateOne(
          { expertiseId: id },
          { $set: { isTransversal: true } }
        );
        console.log(`flagged isTransversal=true on "${id}"`);
      }
    }
    for (const id of emptyScopeWarnings) {
      console.warn(
        `[warn] "${id}" has an empty scope and is NOT transversal — it will ` +
          'no longer be loaded by any filtered findApplicable query. Set a ' +
          'scope, or mark it transversal if that is intended.'
      );
    }
    console.log(
      `Expertise transversal migration: ${toFlag.length} flagged${
        DRY ? ' (dry)' : ''
      }, ${alreadyOk} already ok, ${
        emptyScopeWarnings.length
      } empty-scope warning(s).`
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

module.exports = { planTransversalMigration, TRANSVERSAL_ALLOWLIST };
