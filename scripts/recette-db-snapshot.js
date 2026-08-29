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
 * The dump excludes credentials: `companies` stores `ftpPassword` and `ftpSshKey`
 * (encrypted at rest by the schema's encryption plugin, so a raw-driver dump would
 * write ciphertext nobody can use anyway). None of it is needed to replay a
 * recette, and a file in a home directory is not where it belongs. Files are
 * written 0600 in a 0700 directory all the same.
 *
 * EXCLUDING A FIELD FROM THE DUMP USED TO DESTROY IT ON RESTORE, and that is the
 * single most important thing to know about this file. Restore replaces whole
 * collections, so every excluded field was re-inserted as absent. On 2026-08-29 it
 * wiped every password hash in the development database — and the reset tokens
 * with them, so the accounts could not even be recovered by email. The two halves
 * of the design were each defensible and were never put side by side.
 *
 * Two things changed. `users` left the collection list: a recette writes mailings,
 * companies, taxonomies and workspaces, never users, and the collection was there
 * for completeness alone. And `preserveExcludedFields` now carries every excluded
 * field back from the live database onto the documents being restored, for any
 * collection — so the same mistake is survivable even where it is still reachable.
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
  'workspaces',
];

// `users` used to be here, and restoring it wiped every password hash in the
// development database on 2026-08-29. A recette writes mailings, companies,
// taxonomies and workspaces; it does not write users. The collection was in the
// list for completeness, and completeness was not worth a credential.
//
// The generic protection below (restoreWithPreservedFields) now makes the same
// mistake survivable for any collection. This exclusion makes it unreachable for
// the one collection where it actually cost something.

const DEFAULT_ROOT = path.join(os.homedir(), 'lepatron-recette-backups');

// Never dumped: replaying a recette needs none of it, and a plain file in a home
// directory is the wrong place for a credential — nor for the connection log that
// `sessionMetadata` holds (IP, user agent, sign-in time).
// Only fields that exist in user.schema.js are listed: a name that matches nothing
// reads as a protection that is not actually in place.
const EXCLUDED_FIELDS = {
  users: {
    password: 0,
    token: 0,
    tokenExpire: 0,
    activeSessionId: 0,
    sessionMetadata: 0,
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
 * Whether a connection string points at this machine.
 *
 * The HOST is what matters, not the string: an unanchored search would accept
 * `mongodb://prod.example.com/db?replicaSet=localhost`.
 *
 * @param {string} uri
 * @returns {boolean}
 */
function isLocalHost(uri) {
  try {
    // `mongodb:` is not a scheme URL knows how to parse; `http:` is, and only the
    // host is read out of it.
    const { hostname } = new URL(
      String(uri).replace(/^mongodb(\+srv)?:/, 'http:')
    );
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch (error) {
    return false;
  }
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
  if (!isLocalHost(config.database)) {
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

      // What the dump does not carry must not be destroyed by restoring it.
      const { orphaned } = await preserveExcludedFields(
        db,
        name,
        docs,
        manifest
      );

      await db.collection(name).deleteMany({});
      if (docs.length > 0) {
        // Unordered so one bad document does not abort the rest, leaving the
        // collection emptier than the dump.
        await db.collection(name).insertMany(docs, { ordered: false });
      }
      process.stdout.write(`${name}: ${before} -> ${docs.length} documents\n`);
      if (orphaned.length > 0) {
        // These documents exist in the database, are absent from the dump, and
        // carry fields the dump never stored. Restoring deletes them and the
        // fields go with them — say so rather than let it pass as a count.
        process.stdout.write(
          `${name}: WARNING — ${orphaned.length} document(s) not in the dump ` +
            'carried excluded fields and are being deleted: ' +
            `${orphaned.slice(0, 5).join(', ')}` +
            `${orphaned.length > 5 ? ', …' : ''}\n`
        );
      }
    }
  });
  process.stdout.write(`\nrestored from ${dir}\n`);
}

/**
 * Carries the fields the dump deliberately did not store back onto the documents
 * about to replace the collection.
 *
 * Restore empties a collection and re-inserts the dump. Every field the dump
 * excluded — password hashes, reset tokens, the connection log, FTP credentials —
 * would therefore be destroyed by an operation whose whole point is to put things
 * back. That is not hypothetical: it wiped every password in the development
 * database on 2026-08-29, and the accounts could not even be recovered by email
 * because their reset tokens went with them.
 *
 * The exclusion list is read from the dump's own manifest AND from the current
 * constant, unioned: an old dump may have excluded fields this version no longer
 * names, and vice versa. Preserving a field that did not need preserving costs
 * nothing; missing one costs a database.
 *
 * @returns {{orphaned: string[]}} ids present live, absent from the dump, and
 *   carrying at least one excluded field — they are about to be deleted.
 */
async function preserveExcludedFields(db, name, docs, manifest) {
  const fromManifest = (manifest.excludedFields || {})[name] || {};
  const fields = Array.from(
    new Set(
      Object.keys(EXCLUDED_FIELDS[name] || {}).concat(Object.keys(fromManifest))
    )
  );
  if (fields.length === 0) return { orphaned: [] };

  const projection = { _id: 1 };
  fields.forEach((field) => {
    projection[field] = 1;
  });

  const live = await db.collection(name).find({}, { projection }).toArray();
  const byId = new Map(live.map((doc) => [String(doc._id), doc]));

  docs.forEach((doc) => {
    const kept = byId.get(String(doc._id));
    if (!kept) return;
    byId.delete(String(doc._id));
    fields.forEach((field) => {
      if (kept[field] !== undefined) doc[field] = kept[field];
    });
  });

  // Whatever is left in the map is live-only. It matters only when it actually
  // holds one of the excluded fields — an ordinary document being replaced by the
  // dump is the normal case and not worth a warning.
  const orphaned = [];
  byId.forEach((doc, id) => {
    if (fields.some((field) => doc[field] !== undefined)) orphaned.push(id);
  });

  return { orphaned };
}

async function list(dir) {
  if (!dir) throw new Error('list requires the dump directory');

  // The manifest's list, like restore reads it: listing the constant instead would
  // show `dump -` for a collection restore is simply going to skip, which reads as
  // "empty in the dump" rather than "not in this dump".
  const manifestPath = path.join(dir, 'MANIFEST.json');
  const collections = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).collections ||
      COLLECTIONS
    : COLLECTIONS;

  await withDb(async (db) => {
    for (const name of collections) {
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
