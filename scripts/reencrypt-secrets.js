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
const {
  encrypt,
  decrypt,
  isLegacyEncrypted,
} = require('../packages/server/utils/crypto.js');
const {
  parseArgs,
  confirmDatabase,
  databaseHosts,
  redact,
} = require('./gallery/command-line.js');

// The encrypted fields, as the schemas declare them to the plugin, and the
// two-factor secrets (ADR 0008), which are encrypted by hand.
const TARGETS = [
  { model: modelNames.ProfileModel, fields: ['secretKey', 'accessToken'] },
  { model: modelNames.GroupModel, fields: ['ftpPassword', 'ftpSshKey'] },
  { model: modelNames.IntegrationModel, fields: ['apiKey'] },
  { model: modelNames.UserModel, fields: ['twoFactor.secret'] },
];

const valueAt = (doc, dotted) =>
  dotted.split('.').reduce((node, key) => (node ? node[key] : undefined), doc);

// AES-256-CTR does not tell a wrong key: it decrypts to noise. The secrets
// are text (keys, passwords, SSH keys), so noise is refused rather than
// written again for good, as it would be under another ENCRYPTION_KEY.
const READABLE = /^[\x20-\x7e\t\r\n]*$/;

/**
 * Pure planning step: what one raw document needs.
 *
 * @param {Object} doc a raw document
 * @param {string[]} fields its encrypted fields, dotted
 * @returns {{set: Object|null, unreadable: string[]}} the `$set` to apply,
 *   and the fields left as they are because they do not decrypt to text
 */
function planReencryption(doc, fields) {
  const set = {};
  const unreadable = [];
  fields.forEach((field) => {
    const value = valueAt(doc, field);
    if (!isLegacyEncrypted(value) || value.length <= 32) return;
    const secret = decrypt(value);
    if (READABLE.test(secret)) set[field] = encrypt(secret);
    else unreadable.push(field);
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

  for (const { model, fields } of TARGETS) {
    const collection = db.collection(mongoose.pluralize()(model));
    const query = {
      $or: fields.map((field) => ({ [field]: { $type: 'string' } })),
    };
    let rewritten = 0;
    let unreadable = 0;
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of collection.find(query)) {
      const plan = planReencryption(doc, fields);
      if (plan.unreadable.length > 0) {
        unreadable += 1;
        console.log(
          `${model} ${doc._id}: ${plan.unreadable.join(
            ', '
          )} left as is, not text once decrypted (another key?)`
        );
      }
      const { set } = plan;
      if (!set) continue;
      rewritten += 1;
      // eslint-disable-next-line no-await-in-loop
      if (!dryRun) await collection.updateOne({ _id: doc._id }, { $set: set });
    }
    console.log(
      `${model}: ${rewritten} ${
        dryRun ? 'to rewrite' : 'rewritten'
      }, ${unreadable} left as is`
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
