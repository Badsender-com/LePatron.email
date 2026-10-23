#!/usr/bin/env node
'use strict';

/**
 * Migration: write again in AES-256-GCM the secrets stored in AES-256-CTR
 * (packages/server/utils/crypto.js).
 *
 * The application reads both and writes GCM on the next save; this rewrites
 * at once the values nobody saves. Only values without the `gcm:` prefix are
 * touched, so a rerun is a no-op. The collections are read raw, without the
 * models: their encryption plugin would decrypt on read.
 *
 * Every value rewritten is first copied, as it was, into a backup
 * collection named by the run; `--restore=<backup>` puts them back (only
 * where the value is still the one the run wrote). The backup holds the
 * secrets as they were stored: drop it once the rollout is done.
 *
 * Writes need ENCRYPTION_WRITE_GCM=true, as on the application: it then
 * writes what this script writes.
 *
 * Usage:
 *   node scripts/reencrypt-secrets.js --dry-run
 *   node scripts/reencrypt-secrets.js --confirm-database=<name>
 *   node scripts/reencrypt-secrets.js --restore=<backup> --confirm-database=<name>
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
  decrypt,
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
  {
    model: modelNames.ProfileModel,
    fields: ProfileSchema.encryptedFields,
    readsClear: ProfileSchema.encryptedFieldsReadClear,
  },
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
 * @param {Object} target its model, its encrypted fields (dotted), whether
 *   their values are bound to the document (`bound`, by default), and the
 *   fields that may still hold a secret in clear (`readsClear`): such a value
 *   is encrypted as it is
 * @returns {{set: Object|null, unreadable: string[]}} the `$set` to apply,
 *   and the fields left as they are because they do not decrypt to text
 */
function planReencryption(
  doc,
  { model, fields, bound = true, readsClear = [] }
) {
  const set = {};
  const unreadable = [];
  fields.forEach((field) => {
    const value = valueAt(doc, field);
    const context = bound ? contextOf(model, doc._id, field) : undefined;
    if (readsClear.includes(field)) {
      if (isLegacyEncrypted(value) && value !== '') {
        set[field] = encrypt(value, context);
      }
      return;
    }
    if (!isLegacyEncrypted(value) || value.length <= 32) return;
    const secret = readLegacy(value);
    if (secret === null) unreadable.push(field);
    else {
      set[field] = encrypt(secret, context);
    }
  });
  return { set: Object.keys(set).length > 0 ? set : null, unreadable };
}

const BACKUP_PREFIX = 'reencrypt_backup_';

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

async function run({ dryRun, database }) {
  if (!dryRun && !config.encryptionWriteGcm) {
    throw new Error(
      'Set ENCRYPTION_WRITE_GCM=true on the application first, and here: it ' +
        'then writes what this script writes. Nothing was written.'
    );
  }
  const db = await connect(database);
  const backupName = `${BACKUP_PREFIX}${new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14)}`;
  const backup = db.collection(backupName);

  for (const target of TARGETS) {
    const { model, fields } = target;
    const collectionName = mongoose.pluralize()(model);
    const collection = db.collection(collectionName);
    const query = {
      $or: fields.map((field) => ({ [field]: { $type: 'string' } })),
    };
    const projection = Object.fromEntries(fields.map((field) => [field, 1]));
    let rewritten = 0;
    let unreadable = 0;
    let changedMeanwhile = 0;
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of collection.find(query, { projection })) {
      const plan = planReencryption(doc, target);
      if (plan.unreadable.length > 0) {
        unreadable += 1;
        console.log(
          `${model} ${doc._id}: ${plan.unreadable.join(
            ', '
          )} left as is, not text once decrypted (another key?)`
        );
      }
      for (const [field, value] of Object.entries(plan.set || {})) {
        if (dryRun) {
          rewritten += 1;
          continue;
        }
        const previous = valueAt(doc, field);
        // Backed up before it is written over.
        // eslint-disable-next-line no-await-in-loop
        const { insertedId } = await backup.insertOne({
          collection: collectionName,
          docId: doc._id,
          field,
          previous,
          written: value,
        });
        // Only if the value is still the one read: one saved meanwhile by
        // the application stays.
        // eslint-disable-next-line no-await-in-loop
        const { modifiedCount } = await collection.updateOne(
          { _id: doc._id, [field]: previous },
          { $set: { [field]: value } }
        );
        if (modifiedCount > 0) {
          rewritten += 1;
        } else {
          changedMeanwhile += 1;
          // eslint-disable-next-line no-await-in-loop
          await backup.deleteOne({ _id: insertedId });
        }
      }
    }
    console.log(
      `${model}: ${rewritten} field(s) ${
        dryRun ? 'to rewrite' : 'rewritten'
      }, ${unreadable} document(s) left as is, ${changedMeanwhile} changed meanwhile`
    );
  }
  if (!dryRun) {
    console.log(
      `Backup: ${backupName}. To undo: --restore=${backupName}. Once the ` +
        `rollout is done: db.${backupName}.drop()`
    );
  }
}

/**
 * Puts back the values a run backed up, where the value is still the one
 * the run wrote: a secret saved since is kept.
 */
async function restore({ database, backupName }) {
  if (!backupName.startsWith(BACKUP_PREFIX)) {
    throw new Error(`--restore takes a ${BACKUP_PREFIX}… collection`);
  }
  const db = await connect(database);
  let restored = 0;
  let changedSince = 0;
  // eslint-disable-next-line no-await-in-loop
  for await (const entry of db.collection(backupName).find({})) {
    // eslint-disable-next-line no-await-in-loop
    const { modifiedCount } = await db
      .collection(entry.collection)
      .updateOne(
        { _id: entry.docId, [entry.field]: entry.written },
        { $set: { [entry.field]: entry.previous } }
      );
    if (modifiedCount > 0) restored += 1;
    else changedSince += 1;
  }
  console.log(
    `${restored} field(s) restored, ${changedSince} changed since the run, kept`
  );
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const restoreFlag = argv.find((arg) => arg.startsWith('--restore='));
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const job = restoreFlag
    ? restore({
        database: options.database,
        backupName: restoreFlag.slice('--restore='.length),
      })
    : run(options);
  job
    .then(() => mongoose.disconnect())
    .catch((error) => {
      console.error(redact(error.message));
      process.exitCode = 1;
      return mongoose.disconnect();
    });
}

module.exports = { planReencryption, TARGETS, run, restore };
