#!/usr/bin/env node
'use strict';

/**
 * Migration: stamp AISkillInvocation.expiresAt on documents written before the
 * TTL index existed.
 *
 * Retention used to be enforced by a nightly Agenda job walking every Group.
 * It is now a TTL index on `expiresAt`, computed at write time from the Group's
 * `logRetentionDays` (cf. review R1/A6 — the scheduler brought a second Mongo
 * driver and one connection per cluster worker for a single daily task).
 *
 * Documents with no `expiresAt` are invisible to the TTL monitor, so they would
 * never expire. This backfills them from `startedAt` + their Group's retention.
 * Only documents missing the field are touched, so re-running is a no-op.
 *
 * Note: a document whose computed deadline is already in the past is stamped
 * all the same — Mongo's TTL monitor then deletes it on its next pass (within
 * a minute). That is the intent: it was already beyond its retention window,
 * and the purge job that should have removed it never ran.
 *
 * Usage:
 *   node scripts/migrate-invocation-expires-at.js              # apply
 *   node scripts/migrate-invocation-expires-at.js --dry-run    # report
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
const { AISkillInvocations, Groups } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));
const { DefaultLogRetentionDays } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'ai-skill',
  'constant',
  'skill-constants.js'
));

const DRY = process.argv.includes('--dry-run');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pure planning step (unit-testable). Given a raw invocation and a
 * groupId → retentionDays map, return the deadline to stamp, or null when the
 * document needs nothing.
 *
 * @returns {Date|null}
 */
function planExpiresAt(doc, retentionByGroup, now = new Date()) {
  if (doc.expiresAt) return null; // already stamped
  const days =
    retentionByGroup.get(String(doc._company)) || DefaultLogRetentionDays;
  const from = doc.startedAt ? new Date(doc.startedAt) : now;
  return new Date(from.getTime() + days * MS_PER_DAY);
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const groups = await Groups.find(
      {},
      { _id: 1, logRetentionDays: 1 }
    ).lean();
    const retentionByGroup = new Map(
      groups.map((g) => [String(g._id), g.logRetentionDays])
    );

    const collection = AISkillInvocations.collection;
    const docs = await collection
      .find(
        { expiresAt: { $in: [null, undefined] } },
        { projection: { _id: 1, _company: 1, startedAt: 1, expiresAt: 1 } }
      )
      .toArray();

    const now = new Date();
    let stamped = 0;
    let alreadyDue = 0;
    for (const doc of docs) {
      const expiresAt = planExpiresAt(doc, retentionByGroup, now);
      if (!expiresAt) continue;
      stamped += 1;
      if (expiresAt <= now) alreadyDue += 1;
      if (DRY) continue;
      await collection.updateOne({ _id: doc._id }, { $set: { expiresAt } });
    }

    console.log(
      `expiresAt backfill: ${stamped} invocation(s) ${
        DRY ? 'would be stamped' : 'stamped'
      }, of which ${alreadyDue} already past retention (the TTL monitor will ` +
        'delete those on its next pass).'
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

module.exports = { planExpiresAt };
