#!/usr/bin/env node
'use strict';

/**
 * Migration: versionNumber → versionMajor + versionMinor on LePatronSkill
 * and Expertise documents, and activeVersion (Number) → activeVersion
 * ({ major, minor }). Idempotent — re-running is a no-op.
 *
 * Also stamps a `status` field on each existing version inferred from the
 * old activeVersion + activatedAt:
 *   - active (versionNumber === activeVersion)  →  'ACTIVE'
 *   - activatedAt set but not active            →  'ARCHIVED'
 *   - otherwise                                 →  'DRAFT'
 *
 * Finally, on AISkillInvocation documents, coerces numeric skillVersion to
 * the new "<major>.<minor>" string form.
 *
 * Usage:
 *   node scripts/migrate-version-major-minor.js              # apply
 *   node scripts/migrate-version-major-minor.js --dry-run    # report only
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
const { LePatronSkills, Expertises, AISkillInvocations } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

function inferStatus(version, activeVersionNumber) {
  if (
    version.versionMajor !== undefined &&
    version.versionMinor !== undefined
  ) {
    // Already migrated — keep existing status if present.
    return version.status || 'DRAFT';
  }
  const isActive =
    activeVersionNumber !== null &&
    activeVersionNumber !== undefined &&
    version.versionNumber === activeVersionNumber;
  if (isActive) return 'ACTIVE';
  if (version.activatedAt) return 'ARCHIVED';
  return 'DRAFT';
}

async function migrateDoc(Model, label) {
  const docs = await Model.find({}).lean();
  let touched = 0;
  let alreadyOk = 0;
  for (const doc of docs) {
    const updates = {};

    // activeVersion: Number → { major, minor }
    if (typeof doc.activeVersion === 'number') {
      updates.activeVersion = { major: doc.activeVersion, minor: 0 };
    } else if (doc.activeVersion === null) {
      updates.activeVersion = { major: null, minor: 0 };
    }

    // versions[]: versionNumber → versionMajor + versionMinor + status
    const newVersions = (doc.versions || []).map((v) => {
      if (v.versionMajor !== undefined) return v; // already migrated
      const status = inferStatus(v, doc.activeVersion);
      // Drop the legacy versionNumber field by omitting it from the new shape.
      // eslint-disable-next-line no-unused-vars
      const { versionNumber, ...rest } = v;
      return {
        ...rest,
        versionMajor: versionNumber,
        versionMinor: 0,
        status,
      };
    });

    const versionsChanged = newVersions.some(
      (v, i) =>
        v.versionMajor !== (doc.versions[i] && doc.versions[i].versionMajor)
    );
    if (versionsChanged) updates.versions = newVersions;

    if (Object.keys(updates).length === 0) {
      alreadyOk += 1;
      continue;
    }

    if (DRY) {
      console.log(
        `[dry] ${label} ${doc._id}: would update ${Object.keys(updates).join(
          ', '
        )}`
      );
    } else {
      await Model.updateOne({ _id: doc._id }, { $set: updates });
    }
    touched += 1;
  }
  console.log(
    `${label}: ${touched} document(s) ${
      DRY ? 'would be updated' : 'updated'
    }, ${alreadyOk} already in target shape.`
  );
}

async function migrateInvocations() {
  const total = await AISkillInvocations.countDocuments({
    skillVersion: { $type: 'number' },
  });
  if (total === 0) {
    console.log('AISkillInvocation: no numeric skillVersion left.');
    return;
  }
  if (DRY) {
    console.log(
      `[dry] AISkillInvocation: would coerce ${total} numeric skillVersion → string.`
    );
    return;
  }
  const cursor = AISkillInvocations.find(
    { skillVersion: { $type: 'number' } },
    { skillVersion: 1 }
  ).cursor();
  let count = 0;
  for await (const inv of cursor) {
    await AISkillInvocations.updateOne(
      { _id: inv._id },
      { $set: { skillVersion: `${inv.skillVersion}.0` } }
    );
    count += 1;
  }
  console.log(
    `AISkillInvocation: coerced ${count} numeric skillVersion → "<n>.0".`
  );
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await migrateDoc(LePatronSkills, 'LePatronSkill');
    await migrateDoc(Expertises, 'Expertise');
    await migrateInvocations();
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

module.exports = { inferStatus };
