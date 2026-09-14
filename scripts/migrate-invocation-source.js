#!/usr/bin/env node
'use strict';

/**
 * Migration: rename AISkillInvocation.featureType → invocationSource.
 *
 * The old name was a homonym of AIFeatureConfig.featureType, which means the
 * engine type ('translation' | 'skill') — an orthogonal axis. On the invocation
 * it names WHO issued the call ('playground', 'poc.*', a productive feature),
 * used for analytics only. The two must never be conflated, and until now that
 * invariant was held by documentation alone (cf. review A7).
 *
 * A plain `$rename`, run only on documents that still carry the old field, so
 * re-running it is a no-op. Documents already renamed are left untouched, and
 * a document carrying both (never produced by any code path) keeps its
 * invocationSource: $rename would fail on it, so it is reported and skipped.
 *
 * Usage:
 *   node scripts/migrate-invocation-source.js              # apply
 *   node scripts/migrate-invocation-source.js --dry-run    # report
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
const { AISkillInvocations } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

const OLD_FIELD = 'featureType';
const NEW_FIELD = 'invocationSource';

/**
 * Pure planning step (unit-testable): what should happen to one raw document.
 *
 * @returns {{ action: 'rename'|'skip', reason?: string, value?: any }}
 */
function planInvocationMigration(doc) {
  const hasOld = doc[OLD_FIELD] !== undefined;
  const hasNew = doc[NEW_FIELD] !== undefined;
  if (!hasOld) return { action: 'skip', reason: 'already migrated' };
  if (hasNew) {
    return {
      action: 'skip',
      reason: `carries both fields (${NEW_FIELD}=${doc[NEW_FIELD]}, ${OLD_FIELD}=${doc[OLD_FIELD]}) — left untouched`,
    };
  }
  return { action: 'rename', value: doc[OLD_FIELD] };
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    // Raw collection access: the field no longer exists on the Mongoose schema,
    // so a model read would drop it before we could see it.
    const collection = AISkillInvocations.collection;
    const docs = await collection
      .find(
        { [OLD_FIELD]: { $exists: true } },
        { projection: { _id: 1, [OLD_FIELD]: 1, [NEW_FIELD]: 1 } }
      )
      .toArray();

    let renamed = 0;
    const conflicts = [];
    for (const doc of docs) {
      const plan = planInvocationMigration(doc);
      if (plan.action === 'skip') {
        conflicts.push(`${doc._id}: ${plan.reason}`);
        continue;
      }
      renamed += 1;
      if (DRY) continue;
      await collection.updateOne(
        { _id: doc._id, [NEW_FIELD]: { $exists: false } },
        { $rename: { [OLD_FIELD]: NEW_FIELD } }
      );
    }

    for (const conflict of conflicts) {
      console.warn(`  ! ${conflict}`);
    }
    console.log(
      `${OLD_FIELD} → ${NEW_FIELD}: ${renamed} invocation(s) ${
        DRY ? 'would be renamed' : 'renamed'
      }, ${conflicts.length} skipped.`
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

module.exports = { planInvocationMigration, OLD_FIELD, NEW_FIELD };
