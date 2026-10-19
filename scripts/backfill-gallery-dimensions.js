#!/usr/bin/env node
'use strict';

/**
 * Gallery dimensions backfill: probes the width and height of every stored
 * gallery file that has none yet.
 *
 * The gallery tooltip shows an image's original dimensions. Uploads carry
 * them since US-09, but everything stored before has not, and they cannot be
 * recovered from the thumbnail, a square 111px crop. So each stored file is
 * read back, its head only, and probed.
 *
 * Rerunnable: a file that already has dimensions is skipped, so an interrupted
 * run resumes. A file missing from the storage stays without dimensions, and
 * is read again by every run. See scripts/gallery/README.md before running it
 * on production: it reads the storage the application is configured with.
 *
 * Usage:
 *   node scripts/backfill-gallery-dimensions.js --dry-run [--concurrency=N]
 *   node scripts/backfill-gallery-dimensions.js --confirm-database=<name> [--concurrency=N]
 *
 * A run that writes names its database, as the dry-run prints it: the run
 * refuses to start on any other.
 */

require('dotenv').config();
const { runFromCommandLine } = require('./gallery/run-gallery-script.js');
const {
  readDimensions,
  describeStorage,
  READ_STATUS,
} = require('./gallery/read-dimensions.js');

// 0 is not a dimension an image can have, and the tooltip would print "0 × 0".
const MISSING_DIMENSION = { $in: [null, 0] };
const LACKS_DIMENSIONS = [
  { width: MISSING_DIMENSION },
  { height: MISSING_DIMENSION },
];

// Read again on a rerun, and worth one: the storage was slow or failing.
const TRANSIENT = [READ_STATUS.TIMEOUT, READ_STATUS.ERROR];
// Not fixed by a rerun: the file is gone, has no size this script can find,
// or carries a name it will not hand the storage.
const PERMANENT = [
  READ_STATUS.MISSING,
  READ_STATUS.NOT_AN_IMAGE,
  READ_STATUS.UNMEASURED,
  READ_STATUS.INVALID_NAME,
];

// A storage that stalls costs a timeout (20s) per file: past this many failed
// reads in a row, across the run, it is down, and walking the rest of the
// collection at that pace would prove nothing.
const MAX_FAILED_READS_IN_A_ROW = 10;

// ---------------------------------------------------------------------------
// Pure logic, testable without a database or a storage backend
// ---------------------------------------------------------------------------

function needsDimensions(file) {
  return !file.width || !file.height;
}

/**
 * @param {Array<object>} files as stored
 * @returns {{pending: Map<*, number>, known: number}} the names to read, with
 *   how many entries carry each (legacy galleries can list a name twice)
 */
function planGalleryBackfill(files) {
  const pending = new Map();
  let known = 0;
  for (const file of files) {
    if (needsDimensions(file)) {
      pending.set(file.name, (pending.get(file.name) || 0) + 1);
    } else {
      known += 1;
    }
  }
  return { pending, known };
}

// Under the precondition, so a pair written meanwhile (an upload, another run)
// is left alone and the write is not counted; on every entry of that name.
function buildDimensionsUpdate(galleryId, name, { width, height }) {
  return {
    filter: {
      _id: galleryId,
      files: { $elemMatch: { name, $or: LACKS_DIMENSIONS } },
    },
    update: {
      $set: { 'files.$[file].width': width, 'files.$[file].height': height },
    },
    options: {
      arrayFilters: [
        {
          'file.name': name,
          $or: [
            { 'file.width': MISSING_DIMENSION },
            { 'file.height': MISSING_DIMENSION },
          ],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// One gallery
// ---------------------------------------------------------------------------

function watchStorage(status, { state, stop }) {
  state.failedReadsInARow = TRANSIENT.includes(status)
    ? (state.failedReadsInARow || 0) + 1
    : 0;
  if (state.failedReadsInARow === MAX_FAILED_READS_IN_A_ROW) {
    stop(
      `${MAX_FAILED_READS_IN_A_ROW} storage reads in a row timed out or ` +
        'failed: the storage looks down.'
    );
  }
}

// The gallery is read raw (no Mongoose document, so no schema getter): the
// projection is missing fields this script must not erase. Each pair is
// written as soon as it is read, so an interruption loses at most one read.
// Sequential within a gallery: the runner bounds how many galleries run at
// once, so the storage never sees more reads than that.
async function backfillGallery(gallery, context) {
  const { dryRun, collection, log, read = readDimensions } = context;
  const { isStopping = () => false, stop = () => {}, state = {} } = context;
  const { pending, known } = planGalleryBackfill(gallery.files || []);
  const counts = { filled: 0, known, changedMeanwhile: 0 };
  for (const status of [...TRANSIENT, ...PERMANENT]) counts[status] = 0;

  for (const [name, entries] of pending) {
    if (isStopping()) break;
    // eslint-disable-next-line no-await-in-loop
    const result = await read(name);
    watchStorage(result.status, { state, stop });
    const shownName = JSON.stringify(name) || String(name);
    if (result.status !== READ_STATUS.OK) {
      counts[result.status] += entries;
      log(
        `${result.status}${
          result.code ? ` (${result.code})` : ''
        }: ${shownName}`
      );
      continue;
    }
    if (dryRun) {
      counts.filled += entries;
      continue;
    }
    const { filter, update, options } = buildDimensionsUpdate(
      gallery._id,
      name,
      result
    );
    // eslint-disable-next-line no-await-in-loop
    const { modifiedCount } = await collection.updateOne(
      filter,
      update,
      options
    );
    if (modifiedCount > 0) {
      counts.filled += entries;
    } else {
      counts.changedMeanwhile += entries;
      log(`${shownName} removed or measured meanwhile, left as is`);
    }
  }
  return counts;
}

// Before anything is read for real: a few files already measured must be
// readable, or this is not the storage the application uses (a shell without
// its storage settings reads the local disk) and every file would come out
// "missing".
const STORAGE_CHECK_SAMPLES = 3;
const MEASURED = { width: { $gt: 0 }, height: { $gt: 0 } };

async function checkStorage({ collection }, read = readDimensions) {
  const samples = await collection
    .find({ files: { $elemMatch: MEASURED } }, { projection: { 'files.$': 1 } })
    .limit(STORAGE_CHECK_SAMPLES)
    .toArray();
  if (samples.length === 0) {
    console.log('Storage check: no measured file to check against, skipped.');
    return {};
  }
  const results = [];
  for (const sample of samples) {
    // eslint-disable-next-line no-await-in-loop
    const result = await read(sample.files[0].name);
    if (result.status === READ_STATUS.OK) {
      console.log('Storage check: a file already measured was read back.');
      return { storageVerified: 1 };
    }
    results.push(result.code || result.status);
  }
  throw new Error(
    `storage check failed: none of ${samples.length} file(s) already ` +
      `measured could be read (${results.join(', ')}). Is this the storage ` +
      'the application uses?'
  );
}

const sum = (totals, statuses) =>
  statuses.reduce((total, status) => total + (totals[status] || 0), 0);

// A run that could read nothing has not shown anything about the files: far
// more likely, it read the wrong storage (a shell without the application's
// storage settings reads the local disk).
function assessBackfill(totals) {
  const failures = [];
  const unread = sum(totals, [...TRANSIENT, ...PERMANENT]);
  const read = (totals.filled || 0) + (totals.changedMeanwhile || 0);
  if (unread > 0 && read === 0 && !totals.storageVerified) {
    failures.push(
      `None of the ${unread} file(s) to measure could be read. Check that ` +
        'the storage above is the one the application uses before trusting ' +
        'this run.'
    );
  }
  const transient = sum(totals, TRANSIENT);
  if (transient > 0) {
    failures.push(
      `${transient} read(s) timed out or failed: rerun to retry them.`
    );
  }
  return failures;
}

const backfill = {
  title: 'Gallery dimensions backfill',
  query: { files: { $elemMatch: { $or: LACKS_DIMENSIONS } } },
  projection: { creationOrWireframeId: 1, files: 1 },
  processGallery: backfillGallery,
  describeEnvironment: () => [describeStorage()],
  preflight: (context) => checkStorage(context),
  describeCounts: (counts, { dryRun }) =>
    `${counts.filled} ${dryRun ? 'to fill' : 'filled'}, ` +
    `${counts.known} already known, ` +
    `${sum(counts, [...TRANSIENT, ...PERMANENT])} unreadable`,
  summarize: (totals, { dryRun }) => [
    [dryRun ? 'Dimensions to fill' : 'Dimensions filled', totals.filled],
    ['Already known', totals.known],
    ['Changed meanwhile', totals.changedMeanwhile],
    ['Missing from storage', totals[READ_STATUS.MISSING]],
    ['Not an image', totals[READ_STATUS.NOT_AN_IMAGE]],
    ['Size not found', totals[READ_STATUS.UNMEASURED]],
    ['Unusable name', totals[READ_STATUS.INVALID_NAME]],
    ['Read timed out', totals[READ_STATUS.TIMEOUT]],
    ['Storage error', totals[READ_STATUS.ERROR]],
  ],
  assess: assessBackfill,
};

if (require.main === module) runFromCommandLine(backfill);

module.exports = {
  needsDimensions,
  planGalleryBackfill,
  buildDimensionsUpdate,
  backfillGallery,
  assessBackfill,
  checkStorage,
  backfill,
  MAX_FAILED_READS_IN_A_ROW,
};
