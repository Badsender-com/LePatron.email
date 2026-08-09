#!/usr/bin/env node
'use strict';

/**
 * Migration: move LePatronSkill.inputSchemaId / outputSchemaId from the skill
 * root to each version (cf. UX review §3 — schemas are now versioned, edited
 * in DRAFT like the prompts).
 *
 * For every skill that still has root schemas: copy them into each version
 * that does not already carry its own, then $unset the root fields.
 * Idempotent — a skill whose root fields are already gone is skipped.
 *
 * Usage:
 *   node scripts/migrate-skill-schemas-to-version.js              # apply
 *   node scripts/migrate-skill-schemas-to-version.js --dry-run    # report
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
const { LePatronSkills } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

/**
 * Pure planning step (unit-testable). Given a raw skill doc, return the new
 * versions array with schemas backfilled, or null if nothing to do.
 */
function planSkillMigration(doc) {
  const rootIn = doc.inputSchemaId;
  const rootOut = doc.outputSchemaId;
  if (rootIn === undefined && rootOut === undefined) return null; // already migrated
  const versions = (doc.versions || []).map((v) => ({
    ...v,
    inputSchemaId: v.inputSchemaId || rootIn || '',
    outputSchemaId: v.outputSchemaId || rootOut || '',
  }));
  return versions;
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    // Read raw (lean) so we still see the soon-to-be-removed root fields.
    const docs = await LePatronSkills.find({}).lean();
    let migrated = 0;
    let skipped = 0;
    for (const doc of docs) {
      const versions = planSkillMigration(doc);
      if (!versions) {
        skipped += 1;
        continue;
      }
      if (DRY) {
        console.log(
          `[dry] ${doc.skillId}: would backfill ${versions.length} version(s) ` +
            `from root (${doc.inputSchemaId}/${doc.outputSchemaId}) and unset root`
        );
      } else {
        await LePatronSkills.collection.updateOne(
          { _id: doc._id },
          {
            $set: { versions },
            $unset: { inputSchemaId: '', outputSchemaId: '' },
          }
        );
        console.log(`${doc.skillId}: migrated ${versions.length} version(s)`);
      }
      migrated += 1;
    }
    console.log(
      `Skill schemas → version: ${migrated} skill(s) ${
        DRY ? 'would be migrated' : 'migrated'
      }, ${skipped} already migrated.`
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

module.exports = { planSkillMigration };
