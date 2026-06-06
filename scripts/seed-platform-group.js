#!/usr/bin/env node
'use strict';

/**
 * Seed the internal "platform" Group used by the super-admin AI Playground.
 *
 * The Playground runs skill invocations through the same engine as real
 * features, which resolves the LLM Integration from a Group's AIFeatureConfig.
 * Rather than borrowing a client group's engine, the Playground defaults to
 * this Badsender-owned platform group (see Group.isPlatform).
 *
 * Idempotent — re-running is a no-op (a partial unique index guarantees at
 * most one platform group). The script seeds the group and its AIFeatureConfig
 * (with an inactive 'skill' feature). The super-admin must then enter an API
 * key and activate the engine from the "Fonctionnalités IA" UI — the seed
 * cannot provision a working (encrypted) API key.
 *
 * Usage:
 *   node scripts/seed-platform-group.js
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
const { Groups, AIFeatureConfigs } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));
const Status = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'group',
  'status.js'
));
const { AIFeatureTypeValues } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'constant',
  'ai-feature-type.js'
));

const PLATFORM_GROUP_NAME = 'Badsender — Plateforme IA';

async function seedPlatformGroup() {
  let group = await Groups.findOne({ isPlatform: true });
  if (group) {
    console.log(
      `✓ Platform group already exists: "${group.name}" (${group._id})`
    );
  } else {
    group = await Groups.create({
      name: PLATFORM_GROUP_NAME,
      status: Status.ACTIVE,
      isPlatform: true,
    });
    console.log(`✓ Created platform group "${group.name}" (${group._id})`);
  }

  // Ensure the AIFeatureConfig exists with a default (inactive) feature per
  // type, mirroring ai-feature.service.getOrCreateConfig. The 'skill' feature
  // is what the Playground engine resolves.
  let aiConfig = await AIFeatureConfigs.findOne({ _company: group._id });
  if (!aiConfig) {
    aiConfig = await AIFeatureConfigs.create({
      _company: group._id,
      features: AIFeatureTypeValues.map((featureType) => ({
        featureType,
        integration: null,
        isActive: false,
        config: { availableLanguages: [], defaultSourceLanguage: 'auto' },
      })),
    });
    console.log(
      `✓ Created AIFeatureConfig with features: ${AIFeatureTypeValues.join(
        ', '
      )}`
    );
  } else {
    console.log('✓ AIFeatureConfig already exists for the platform group');
  }

  console.log(
    '\n⚠️  Next step: open the platform group in "Fonctionnalités IA", select an\n' +
      '   Integration for the Skills engine and activate it. The seed cannot\n' +
      '   provision the (encrypted) API key.'
  );
}

async function main() {
  console.log(`Connecting to ${config.database}…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await seedPlatformGroup();
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

module.exports = { seedPlatformGroup, PLATFORM_GROUP_NAME };
