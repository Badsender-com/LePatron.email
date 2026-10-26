#!/usr/bin/env node
'use strict';

/**
 * Migration: the secrets the database keeps, from AES-256-CTR to AES-256-GCM
 * bound to their record (packages/server/utils/crypto.js), and back.
 *
 * It reads every value first. If a single one does not read (another
 * ENCRYPTION_KEY, a value altered), it says which and writes nothing.
 * Otherwise it rewrites them all, each only if it still holds the value read,
 * so a secret the application saves meanwhile is kept. A rerun writes
 * nothing. The collections are read raw: their encryption plugin would
 * decrypt on read.
 *
 * --downgrade writes them all back in the former format, which the previous
 * version of the application reads: with ENCRYPTION_WRITE_LEGACY=true on the
 * application, it runs on the former format until a fix, or the previous
 * version can be deployed again.
 *
 * Usage:
 *   node scripts/reencrypt-secrets.js --dry-run [--downgrade]
 *   node scripts/reencrypt-secrets.js --confirm-database=<name> [--downgrade]
 */

const mongoose = require('mongoose');

require('dotenv').config();
const config = require('../packages/server/node.config.js');
const modelNames = require('../packages/server/constant/model.names.js');
const ProfileSchema = require('../packages/server/profile/profile.schema.js');
const GroupSchema = require('../packages/server/group/group.schema.js');
const IntegrationSchema = require('../packages/server/integration/integration.schema.js');
const {
  encrypt,
  encryptLegacy,
  decrypt,
  isEncrypted,
  isLegacyEncrypted,
} = require('../packages/server/utils/crypto.js');
const { contextOf } = require('../packages/server/utils/encryption-plugin.js');
const {
  parseArgs,
  confirmDatabase,
  databaseHosts,
  redact,
} = require('./gallery/command-line.js');

// The encrypted fields, as the schemas declare them to the plugin, and the
// two-factor secrets (#1324), which are encrypted by hand.
const TARGETS = [
  { model: modelNames.ProfileModel, fields: ProfileSchema.encryptedFields },
  { model: modelNames.GroupModel, fields: GroupSchema.encryptedFields },
  {
    model: modelNames.IntegrationModel,
    fields: IntegrationSchema.encryptedFields,
  },
  // Encrypted by hand, without a context, until #1324 binds them.
  { model: modelNames.UserModel, fields: ['twoFactor.secret'], bound: false },
];

const valueAt = (doc, dotted) =>
  dotted.split('.').reduce((node, key) => (node ? node[key] : undefined), doc);

// AES-256-CTR does not tell a wrong key: it decrypts to noise. The secrets
// are text (keys, passwords, SSH keys), so what is not valid UTF-8 or holds
// control characters is refused rather than written again for good, as it
// would be under another ENCRYPTION_KEY.
// eslint-disable-next-line no-control-regex -- control characters are the point
const NOT_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/;

function readLegacy(value) {
  try {
    const secret = decrypt(value);
    return NOT_TEXT.test(secret) ? null : secret;
  } catch (error) {
    return null;
  }
}

/**
 * Pure planning step: what one raw document needs.
 *
 * @param {Object} doc a raw document
 * @param {Object} target its model, its encrypted fields (dotted), and
 *   whether their values are bound to the document (`bound`, by default)
 * @returns {{set: Object|null, unreadable: string[]}} the `$set` to apply,
 *   and the fields left as they are because they do not decrypt to text
 */
function planReencryption(doc, { model, fields, bound = true }) {
  const set = {};
  const unreadable = [];
  fields.forEach((field) => {
    const value = valueAt(doc, field);
    if (!isLegacyEncrypted(value) || value.length <= 32) return;
    const secret = readLegacy(value);
    if (secret === null) unreadable.push(field);
    else {
      set[field] = encrypt(
        secret,
        bound ? contextOf(model, doc._id, field) : undefined
      );
    }
  });
  return { set: Object.keys(set).length > 0 ? set : null, unreadable };
}

/**
 * Pure planning step of --downgrade: the former format for each value in
 * GCM, the secret itself for a field the previous version stored in clear.
 *
 * @param {Object} doc a raw document
 * @param {Object} target as for planReencryption
 * @returns {{set: Object|null, unreadable: string[]}}
 */
function planDowngrade(doc, { model, fields, bound = true, readsClear = [] }) {
  const set = {};
  const unreadable = [];
  fields.forEach((field) => {
    const value = valueAt(doc, field);
    if (!isEncrypted(value)) return;
    let secret;
    try {
      secret = decrypt(
        value,
        bound ? contextOf(model, doc._id, field) : undefined
      );
    } catch (error) {
      unreadable.push(field);
      return;
    }
    set[field] = readsClear.includes(field) ? secret : encryptLegacy(secret);
  });
  return { set: Object.keys(set).length > 0 ? set : null, unreadable };
}

async function connect(database) {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const { db } = mongoose.connection;
  console.log(
    `Connected to ${databaseHosts(config.database)}/${db.databaseName}`
  );
  confirmDatabase(db.databaseName, database);
  return db;
}

// Every value read and planned, before anything is written.
async function planAll(db, plan) {
  const plans = [];
  let unreadable = 0;
  for (const target of TARGETS) {
    const collectionName = mongoose.pluralize()(target.model);
    const query = {
      $or: target.fields.map((field) => ({ [field]: { $type: 'string' } })),
    };
    const projection = Object.fromEntries(
      target.fields.map((field) => [field, 1])
    );
    let fields = 0;
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of db
      .collection(collectionName)
      .find(query, { projection })) {
      const { set, unreadable: refused } = plan(doc, target);
      refused.forEach((field) => {
        unreadable += 1;
        console.log(`${target.model} ${doc._id} ${field}: does not read`);
      });
      if (set) {
        fields += Object.keys(set).length;
        plans.push({ collectionName, doc, set });
      }
    }
    console.log(`${target.model}: ${fields} field(s) to rewrite`);
  }
  return { plans, unreadable };
}

async function run({ dryRun, database, downgrade }) {
  if (!downgrade && config.encryptionWriteLegacy) {
    throw new Error(
      'ENCRYPTION_WRITE_LEGACY is on: the application writes the former ' +
        'format. Turn it off first. Nothing was written.'
    );
  }
  const db = await connect(database);
  const { plans, unreadable } = await planAll(
    db,
    downgrade ? planDowngrade : planReencryption
  );
  if (unreadable > 0) {
    throw new Error(
      `${unreadable} value(s) do not read (listed above): nothing was written.`
    );
  }
  if (dryRun) return;

  let rewritten = 0;
  let changedMeanwhile = 0;
  for (const { collectionName, doc, set } of plans) {
    for (const [field, value] of Object.entries(set)) {
      // Only if the value is still the one read: one saved meanwhile by the
      // application is kept.
      // eslint-disable-next-line no-await-in-loop
      const { modifiedCount } = await db
        .collection(collectionName)
        .updateOne(
          { _id: doc._id, [field]: valueAt(doc, field) },
          { $set: { [field]: value } }
        );
      if (modifiedCount > 0) rewritten += 1;
      else changedMeanwhile += 1;
    }
  }
  console.log(
    `${rewritten} field(s) rewritten${
      downgrade ? ' in the former format' : ''
    }, ${changedMeanwhile} saved meanwhile by the application, kept`
  );
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let options;
  try {
    options = { ...parseArgs(argv), downgrade: argv.includes('--downgrade') };
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  run(options)
    .then(() => mongoose.disconnect())
    .catch((error) => {
      console.error(redact(error.message));
      process.exitCode = 1;
      return mongoose.disconnect();
    });
}

module.exports = { planReencryption, planDowngrade, TARGETS, run };
