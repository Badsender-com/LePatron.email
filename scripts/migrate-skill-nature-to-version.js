#!/usr/bin/env node
'use strict';

/**
 * Migration: move LePatronSkill.nature from the skill to each version (commit
 * beb675c80, ADR 0013: the nature of a skill belongs to its version).
 *
 * A skill written before keeps its nature on the skill and none on its
 * versions; read by version, it is then a feature skill, and a task skill is
 * no longer served to assistants. For every skill that still has a nature:
 * copy it into each version that does not carry its own, then $unset it.
 * Idempotent: a skill with no nature of its own is skipped.
 *
 * Usage:
 *   node scripts/migrate-skill-nature-to-version.js              # apply
 *   node scripts/migrate-skill-nature-to-version.js --dry-run    # report
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
 * Pure planning step (unit-testable). Given a raw skill doc, return its
 * versions with the skill's nature where they have none, or null if there is
 * nothing to do.
 */
function planNatureMigration(doc) {
  if (doc.nature === undefined || doc.nature === null) return null;
  return (doc.versions || []).map((version) => ({
    ...version,
    nature: version.nature || doc.nature,
  }));
}

// Host (and port) of a Mongo connection string, without user:password or query
// parameters. Falls back to a placeholder rather than risk echoing the URI.
function databaseHost(uri) {
  try {
    return new URL(uri).host || 'mongo';
  } catch (e) {
    return 'mongo';
  }
}

async function main() {
  // Never log the connection string: it carries the credentials.
  console.log(
    `Connecting to ${databaseHost(config.database)} (dry-run=${DRY})…`
  );
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    // Read raw (lean): the schema no longer declares the skill's nature.
    const docs = await LePatronSkills.find({}).lean();
    let migrated = 0;
    let skipped = 0;
    for (const doc of docs) {
      const versions = planNatureMigration(doc);
      if (!versions) {
        skipped += 1;
        continue;
      }
      if (DRY) {
        console.log(
          `[dry] ${doc.skillId}: would set the nature "${doc.nature}" on its ` +
            'versions without one, and unset it on the skill'
        );
      } else {
        // eslint-disable-next-line no-await-in-loop
        await LePatronSkills.collection.updateOne(
          { _id: doc._id },
          { $set: { versions }, $unset: { nature: '' } }
        );
        console.log(
          `${doc.skillId}: nature "${doc.nature}" moved to its versions`
        );
      }
      migrated += 1;
    }
    console.log(
      `Skill nature → version: ${migrated} skill(s) ${
        DRY ? 'would be migrated' : 'migrated'
      }, ${skipped} with no nature of their own.`
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

module.exports = { planNatureMigration };
