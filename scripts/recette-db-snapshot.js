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
 * collection absent from the dump.
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
  fs.mkdirSync(dir, { recursive: true });

  await withDb(async (db) => {
    for (const name of COLLECTIONS) {
      const docs = await db.collection(name).find({}).toArray();
      fs.writeFileSync(
        path.join(dir, `${name}.bson`),
        Buffer.concat(docs.map((doc) => BSON.serialize(doc)))
      );
      process.stdout.write(`${name}: ${docs.length} documents\n`);
    }
  });

  fs.writeFileSync(
    path.join(dir, 'MANIFEST.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        database: config.database,
        collections: COLLECTIONS,
      },
      null,
      1
    )
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

  await withDb(async (db) => {
    for (const name of COLLECTIONS) {
      const file = path.join(dir, `${name}.bson`);
      if (!fs.existsSync(file)) {
        process.stdout.write(`${name}: absent du dump, ignorée\n`);
        continue;
      }
      const docs = readBson(file);
      const before = await db.collection(name).countDocuments();
      await db.collection(name).deleteMany({});
      if (docs.length > 0) {
        await db.collection(name).insertMany(docs);
      }
      process.stdout.write(
        `${name}: ${before} → ${docs.length} documents restaurés\n`
      );
    }
  });
  process.stdout.write(`\nrestauré depuis: ${dir}\n`);
}

async function list(dir) {
  if (!dir) throw new Error('list requires the dump directory');
  await withDb(async (db) => {
    for (const name of COLLECTIONS) {
      const file = path.join(dir, `${name}.bson`);
      const dumped = fs.existsSync(file) ? readBson(file).length : '—';
      const current = await db.collection(name).countDocuments();
      process.stdout.write(`${name}: dump ${dumped} · actuel ${current}\n`);
    }
  });
}

const [action, target] = process.argv.slice(2);

const actions = { dump, restore, list };

if (!actions[action]) {
  process.stderr.write(
    'usage: recette-db-snapshot.js dump [dir] | restore <dir> | list <dir>\n'
  );
  process.exit(1);
}

actions[action](target).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
