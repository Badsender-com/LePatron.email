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
 * Usage:
 *   node scripts/reencrypt-secrets.js --dry-run
 *   node scripts/reencrypt-secrets.js --confirm-database=<name>
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

async function run({ dryRun, database }) {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const { db } = mongoose.connection;
  console.log(
    `Connected to ${databaseHosts(config.database)}/${db.databaseName}`
  );
  confirmDatabase(db.databaseName, database);

  for (const target of TARGETS) {
    const { model, fields } = target;
    const collection = db.collection(mongoose.pluralize()(model));
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
        // Only if the value is still the one read: one saved meanwhile by
        // the application is already in GCM, and stays.
        // eslint-disable-next-line no-await-in-loop
        const { modifiedCount } = await collection.updateOne(
          { _id: doc._id, [field]: valueAt(doc, field) },
          { $set: { [field]: value } }
        );
        if (modifiedCount > 0) rewritten += 1;
        else changedMeanwhile += 1;
      }
    }
    console.log(
      `${model}: ${rewritten} field(s) ${
        dryRun ? 'to rewrite' : 'rewritten'
      }, ${unreadable} document(s) left as is, ${changedMeanwhile} changed meanwhile`
    );
  }
}

if (require.main === module) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
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

module.exports = { planReencryption, TARGETS };
