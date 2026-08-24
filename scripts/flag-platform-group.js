#!/usr/bin/env node
'use strict';

/**
 * Flag an EXISTING group as the platform group.
 *
 * In every LePatron install there is already a group used by the operator
 * (e.g. Badsender, or the self-hosting customer's internal group). The
 * super-admin AI Playground runs its skill invocations on that group's engine.
 * Rather than seeding a dedicated group, we mark the existing operator group
 * with `isPlatform: true` — a one-shot ops step run once post-install.
 *
 * Validates that the group exists and that no OTHER group is already flagged
 * (a partial unique index also enforces this at the DB level). Idempotent if
 * the target group is already the platform group.
 *
 * Usage:
 *   yarn flag-platform-group <groupId>
 *   node scripts/flag-platform-group.js <groupId>
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
const { Groups } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

async function flagPlatformGroup(groupId) {
  if (!groupId) {
    throw new Error('Usage: yarn flag-platform-group <groupId>');
  }
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error(`"${groupId}" is not a valid group id`);
  }

  const group = await Groups.findById(groupId);
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }

  const existing = await Groups.findOne({ isPlatform: true });
  if (existing && String(existing._id) !== String(group._id)) {
    throw new Error(
      `Another group is already the platform group: "${existing.name}" ` +
        `(${existing._id}). Unset it first if you want to move the flag.`
    );
  }

  if (group.isPlatform) {
    console.log(
      `✓ "${group.name}" (${group._id}) is already the platform group`
    );
    return;
  }

  group.isPlatform = true;
  await group.save();
  console.log(`✓ Flagged "${group.name}" (${group._id}) as the platform group`);
  console.log(
    '\n⚠️  Next step: open this group in "Fonctionnalités IA", select an\n' +
      '   Integration for the Skills engine and activate it.'
  );
}

async function main() {
  const groupId = process.argv[2];
  console.log(`Connecting to ${config.database}…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await flagPlatformGroup(groupId);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { flagPlatformGroup };
