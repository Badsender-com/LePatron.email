#!/usr/bin/env node
'use strict';

/**
 * Gallery V1 migration: gives every stored gallery image the V1 fields
 * (label, source, externalMetadata, uploadedAt) it does not have yet.
 *
 * Rerunnable: an image that already has an uploadedAt is left alone, so a
 * rerun, or a resume after an interruption, only does what is left.
 * See scripts/gallery/README.md before running it on production.
 *
 * Usage:
 *   node scripts/migrate-gallery-v1.js [--dry-run] [--concurrency=N]
 */

require('dotenv').config();
const { runGalleryScript } = require('./gallery/run-gallery-script.js');

// `null` in a query matches a missing field as well as a null one: what the
// first version of this script wrote when a gallery had no createdAt.
const NOT_MIGRATED = null;
const UNSET = { $in: [null, ''] };

// ---------------------------------------------------------------------------
// Pure logic, testable without a database
// ---------------------------------------------------------------------------

// The images have no upload date of their own; the gallery's is the closest.
// A document inserted by hand may lack createdAt, but its ObjectId still
// carries the second it was created. Never null: a null uploadedAt is "not
// migrated", and the image would be migrated again on every run.
function migrationDate(gallery) {
  if (gallery.createdAt instanceof Date) return gallery.createdAt;
  if (gallery._id && typeof gallery._id.getTimestamp === 'function') {
    return gallery._id.getTimestamp();
  }
  throw new Error('no createdAt and no ObjectId to date its images from');
}

/**
 * @param {Array<object>} files as stored
 * @returns {{pending: Map<string, number>, upToDate: number, invalid: number}}
 *   the names still to migrate, with how many entries carry each (legacy
 *   galleries can list the same name twice)
 */
function planGalleryMigration(files) {
  const pending = new Map();
  let upToDate = 0;
  let invalid = 0;
  for (const file of files) {
    if (file.uploadedAt) {
      upToDate += 1;
    } else if (typeof file.name !== 'string' || file.name === '') {
      // a name goes into a query: anything but a string could be an operator
      invalid += 1;
    } else {
      pending.set(file.name, (pending.get(file.name) || 0) + 1);
    }
  }
  return { pending, upToDate, invalid };
}

/**
 * The update for every entry named `name` that is still not migrated.
 *
 * The precondition lives in the write, not only in the read: between the two,
 * a user can rename the image (its label) or the app can migrate it, and the
 * update must then leave what they wrote. `arrayFilters` rather than `$`, which
 * would only reach the first of two entries with the same name.
 */
function buildMigrationUpdate(galleryId, name, uploadedAt) {
  const pending = (id) => ({
    [`${id}.name`]: name,
    [`${id}.uploadedAt`]: NOT_MIGRATED,
  });
  return {
    filter: {
      _id: galleryId,
      files: { $elemMatch: { name, uploadedAt: NOT_MIGRATED } },
    },
    update: {
      $set: {
        'files.$[file].uploadedAt': uploadedAt,
        'files.$[unlabelled].label': name,
        'files.$[unsourced].source': 'upload',
        'files.$[bare].externalMetadata': {},
      },
    },
    options: {
      arrayFilters: [
        pending('file'),
        { ...pending('unlabelled'), 'unlabelled.label': UNSET },
        { ...pending('unsourced'), 'unsourced.source': UNSET },
        { ...pending('bare'), 'bare.externalMetadata': null },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// One gallery
// ---------------------------------------------------------------------------

// The gallery is read raw (no Mongoose document, so no schema getter): the
// getter projects each file onto a fixed set of keys, and writing that
// projection back is how a first version erased `originalName`.
async function migrateGallery(gallery, { dryRun, collection, log }) {
  const { pending, upToDate, invalid } = planGalleryMigration(
    gallery.files || []
  );
  const counts = { migrated: 0, upToDate, invalid, changedMeanwhile: 0 };
  if (invalid > 0) log(`${invalid} image(s) without a usable name, left as is`);
  if (pending.size === 0) return counts;

  const uploadedAt = migrationDate(gallery);
  for (const [name, entries] of pending) {
    if (dryRun) {
      counts.migrated += entries;
      continue;
    }
    const { filter, update, options } = buildMigrationUpdate(
      gallery._id,
      name,
      uploadedAt
    );
    // eslint-disable-next-line no-await-in-loop
    const { modifiedCount } = await collection.updateOne(
      filter,
      update,
      options
    );
    if (modifiedCount > 0) {
      counts.migrated += entries;
    } else {
      counts.changedMeanwhile += entries;
      log(`${JSON.stringify(name)} removed or migrated meanwhile, left as is`);
    }
  }
  return counts;
}

const migration = {
  title: 'Gallery V1 migration',
  query: { files: { $elemMatch: { uploadedAt: NOT_MIGRATED } } },
  projection: { creationOrWireframeId: 1, createdAt: 1, files: 1 },
  processGallery: migrateGallery,
  describeCounts: (counts, { dryRun }) =>
    `${counts.migrated} ${dryRun ? 'to migrate' : 'migrated'}, ` +
    `${counts.upToDate} already up to date`,
  summarize: (totals, { dryRun }) => [
    [dryRun ? 'Images to migrate' : 'Images migrated', totals.migrated],
    ['Already up to date', totals.upToDate],
    ['Changed meanwhile', totals.changedMeanwhile],
    ['Without a name', totals.invalid],
  ],
};

if (require.main === module) {
  runGalleryScript(migration).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`Fatal error: ${error.message}`);
      process.exitCode = 1;
    }
  );
}

module.exports = {
  migrationDate,
  planGalleryMigration,
  buildMigrationUpdate,
  migrateGallery,
  migration,
};
