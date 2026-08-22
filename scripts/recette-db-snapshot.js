#!/usr/bin/env node
'use strict';

/**
 * Targeted snapshot / restore of the collections a manual or automated recette
 * writes to. Stands in for `mongodump`, which is not installed on this machine.
 *
 * Writes real BSON — the same format `mongodump` produces, one `.bson` file per
 * collection holding concatenated documents. ObjectIds, Dates and Binary survive
 * the round trip untouched; a JSON dump would turn them into strings and quietly
 * corrupt the collection on restore. The bundled bson 1.x has no EJSON, and these
 * files stay readable by `mongorestore` should it ever be installed.
 *
 *   node scripts/recette-db-snapshot.js dump    [directory]
 *   node scripts/recette-db-snapshot.js restore <directory>
 *   node scripts/recette-db-snapshot.js list    <directory>
 *
 * Restore is a full replacement of the listed collections: everything created
 * since the dump is removed, everything modified is put back. It never touches a
 * collection absent from the dump. It therefore refuses to run unless every one of
 * these holds: the config says development, the database is local, the dump names
 * the same database, and `--yes` was passed. An interrupted restore leaves the
 * collections it had already emptied in a partial state — there is no transaction.
 *
 * The dump excludes credentials. `users` carries password hashes and reset
 * tokens, `companies` stores `ftpPassword` and `ftpSshKey` in clear; none of that
 * is needed to replay a recette, and a world-readable file in a home directory is
 * not where it belongs. Files are written 0600 in a 0700 directory all the same.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { MongoClient } = require('mongodb');
// bson 1.x exports the constructor, not the functions: the serializer is an
// instance method there, unlike bson 4+.
const BSONLib = require('bson');
const BSON = new BSONLib.BSON();

const config = require('../packages/server/node.config.js');

// The collections the email-metadata work writes to. Deliberately explicit: a
// wildcard dump would be slow and would give a false sense of coverage.
const COLLECTIONS = [
  'creations', // mailings — the Mailing model points here, NOT `mailings`
  'companies', // groups — the Company model points here
  'taxonomyitems',
  'users',
  'workspaces',
];

const DEFAULT_ROOT = path.join(os.homedir(), 'lepatron-recette-backups');

// Never dumped: replaying a recette needs none of it, and a plain file in a home
// directory is the wrong place for a credential.
const EXCLUDED_FIELDS = {
  users: {
    password: 0,
    token: 0,
    tokenExpire: 0,
    resetToken: 0,
    resetTokenExpiration: 0,
    activeSessionId: 0,
  },
  companies: { ftpPassword: 0, ftpSshKey: 0 },
};

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

/**
 * The database, without its credentials — the manifest is a plain file, and the
 * connection string may carry a password.
 *
 * @param {string} uri
 * @returns {string}
 */
function redactUri(uri) {
  return String(uri).replace(/\/\/[^@/]*@/, '//<redacted>@');
}

/**
 * Restore empties collections. It runs only against a local development database
 * named by the dump itself, and only when explicitly confirmed.
 *
 * @param {Object} manifest
 */
function assertRestoreIsSafe(manifest) {
  if (!process.argv.includes('--yes')) {
    throw new Error(
      'restore replaces whole collections. Re-run with --yes once you have read what it will do.'
    );
  }
  if (config.isDev !== true) {
    throw new Error(
      `refusing to restore: config.isDev is ${config.isDev}, this is not a development environment`
    );
  }
  if (!/(localhost|127\.0\.0\.1)/.test(config.database)) {
    throw new Error(
      `refusing to restore: ${redactUri(
        config.database
      )} is not a local database`
    );
  }
  if (manifest.database && manifest.database !== redactUri(config.database)) {
    throw new Error(
      `refusing to restore: the dump was taken from ${
        manifest.database
      }, the current database is ${redactUri(config.database)}`
    );
  }
}

/**
 * Reads a concatenated-BSON file the way mongorestore does: each document is
 * prefixed by its own length as a little-endian int32.
 *
 * @param {string} file
 * @returns {Array<Object>}
 */
function readBson(file) {
  const buffer = fs.readFileSync(file);
  const docs = [];
  let offset = 0;

  while (offset < buffer.length) {
    const size = buffer.readInt32LE(offset);
    if (size <= 0 || offset + size > buffer.length) {
      throw new Error(`${file} is truncated or not BSON (at byte ${offset})`);
    }
    docs.push(BSON.deserialize(buffer.slice(offset, offset + size)));
    offset += size;
  }

  return docs;
}

async function withDb(fn) {
  const client = await MongoClient.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

async function dump(target) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const dir = target || path.join(DEFAULT_ROOT, stamp);
  fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });

  await withDb(async (db) => {
    for (const name of COLLECTIONS) {
      const projection = EXCLUDED_FIELDS[name];
      const docs = await db
        .collection(name)
        .find({}, projection ? { projection } : {})
        .toArray();
      fs.writeFileSync(
        path.join(dir, `${name}.bson`),
        Buffer.concat(docs.map((doc) => BSON.serialize(doc))),
        { mode: FILE_MODE }
      );
      process.stdout.write(
        `${name}: ${docs.length} documents${
          projection ? ' (credentials excluded)' : ''
        }\n`
      );
    }
  });

  fs.writeFileSync(
    path.join(dir, 'MANIFEST.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        // Redacted: the manifest is a plain file, and a connection string may
        // carry a password.
        database: redactUri(config.database),
        collections: COLLECTIONS,
        excludedFields: EXCLUDED_FIELDS,
      },
      null,
      1
    ),
    { mode: FILE_MODE }
  );
  process.stdout.write(`\ndump: ${dir}\n`);
  return dir;
}

async function restore(dir) {
  if (!dir) throw new Error('restore requires the dump directory');
  const manifestPath = path.join(dir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`no MANIFEST.json in ${dir} — refusing to restore`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assertRestoreIsSafe(manifest);

  // The dump's own list, not the constant: an older dump covering fewer
  // collections must not be silently taken for a complete one.
  const collections = manifest.collections || COLLECTIONS;
  process.stdout.write(
    `restoring ${collections.join(', ')} into ${redactUri(config.database)}\n`
  );

  await withDb(async (db) => {
    for (const name of collections) {
      const file = path.join(dir, `${name}.bson`);
      if (!fs.existsSync(file)) {
        process.stdout.write(`${name}: not in the dump, skipped\n`);
        continue;
      }
      const docs = readBson(file);
      const before = await db.collection(name).countDocuments();
      await db.collection(name).deleteMany({});
      if (docs.length > 0) {
        // Unordered so one bad document does not abort the rest, leaving the
        // collection emptier than the dump.
        await db.collection(name).insertMany(docs, { ordered: false });
      }
      process.stdout.write(`${name}: ${before} -> ${docs.length} documents\n`);
    }
  });
  process.stdout.write(`\nrestored from ${dir}\n`);
}

async function list(dir) {
  if (!dir) throw new Error('list requires the dump directory');
  await withDb(async (db) => {
    for (const name of COLLECTIONS) {
      const file = path.join(dir, `${name}.bson`);
      const dumped = fs.existsSync(file) ? readBson(file).length : '-';
      const current = await db.collection(name).countDocuments();
      process.stdout.write(`${name}: dump ${dumped} · current ${current}\n`);
    }
  });
}

const [action, target] = process.argv.slice(2);

// Null-prototype so `constructor` and friends are not mistaken for actions.
const actions = Object.assign(Object.create(null), { dump, restore, list });

if (!actions[action]) {
  process.stderr.write(
    'usage: recette-db-snapshot.js dump [dir] | restore <dir> --yes | list <dir>\n'
  );
  process.exit(1);
}

actions[action](target).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
