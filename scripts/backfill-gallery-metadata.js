#!/usr/bin/env node
'use strict';

/**
 * Gallery metadata backfill: gives every stored gallery file the width, height
 * and upload date it does not have yet, from the storage itself.
 *
 * The gallery shows an image's original dimensions and the date it joined the
 * gallery. Uploads carry both since the gallery V1 (#1293); everything stored
 * before has neither. The dimensions cannot be recovered from the thumbnail, a
 * square 111px crop, so each stored file is read back, its head only, and
 * probed. The date is the one the storage holds for the file (S3's
 * Last-Modified, the mtime on disk), read from the same request: never one
 * made up, a file without it stays without a date.
 *
 * Rerunnable: each field is written only where it is still missing, under that
 * precondition, so an interrupted run resumes. A file missing from the storage
 * stays as it is, and is read again by every run. See scripts/gallery/README.md
 * before running it on production: only once #1293 is deployed.
 *
 * Usage:
 *   node scripts/backfill-gallery-metadata.js --dry-run [--concurrency=N]
 *   node scripts/backfill-gallery-metadata.js --confirm-database=<name> [--concurrency=N]
 *
 * A run that writes names its database, as the dry-run prints it: the run
 * refuses to start on any other.
 */

require('dotenv').config();
const { runFromCommandLine } = require('./gallery/run-gallery-script.js');
const {
  readStoredFile,
  READ_STATUS,
  FOUND,
} = require('./gallery/read-stored-file.js');
const { describeStorage } = require('./gallery/storage.js');
const {
  planGalleryBackfill,
  buildDimensionsUpdate,
  buildDateUpdate,
  LACKS_DIMENSIONS,
  LACKS_DATE,
} = require('./gallery/backfill-plan.js');

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

// Written, or in a dry-run counted as to write.
async function fill(change, { dryRun, collection }) {
  if (dryRun) return true;
  const { filter, update, options } = change;
  const { modifiedCount } = await collection.updateOne(filter, update, options);
  return modifiedCount > 0;
}

// What one read gives one name: its dimensions, its date, or why not.
async function applyRead(galleryId, name, need, result, context) {
  const shownName = JSON.stringify(name) || String(name);
  const counts = {};
  const add = (key, entries) => {
    counts[key] = (counts[key] || 0) + entries;
  };
  const note = (key) =>
    context.log(
      `${key}${result.code ? ` (${result.code})` : ''}: ${shownName}`
    );
  const write = async (change, key, entries) => {
    if (await fill(change, context)) return add(key, entries);
    add('changedMeanwhile', entries);
    return note('removed or filled meanwhile, left as is');
  };

  // not read: nothing to write, the reason is what the operator needs
  if (!FOUND.includes(result.status)) {
    add(result.status, need.entries);
    note(result.status);
    return counts;
  }
  if (need.unsized > 0 && result.status !== READ_STATUS.OK) {
    add(result.status, need.unsized);
    note(result.status);
  } else if (need.unsized > 0) {
    const change = buildDimensionsUpdate(galleryId, name, result);
    await write(change, 'sized', need.unsized);
  }
  // read, even if not measurable: its storage date is still its date
  if (need.undated > 0 && !result.storedAt) {
    add('undatable', need.undated);
    note('no storage date');
  } else if (need.undated > 0) {
    const change = buildDateUpdate(galleryId, name, result.storedAt);
    await write(change, 'dated', need.undated);
  }
  return counts;
}

// The gallery is read raw (no Mongoose document, so no schema getter): the
// projection is missing fields this script must not erase. Each name is
// written as soon as it is read, so an interruption loses at most one read.
// Sequential within a gallery: the runner bounds how many galleries run at
// once, so the storage never sees more reads than that.
async function backfillGallery(gallery, context) {
  const { read = readStoredFile, isStopping = () => false } = context;
  const { stop = () => {}, state = {} } = context;
  const { pending, known } = planGalleryBackfill(gallery.files || []);
  const counts = { sized: 0, dated: 0, known, changedMeanwhile: 0 };

  for (const [name, need] of pending) {
    if (isStopping()) break;
    // eslint-disable-next-line no-await-in-loop
    const result = await read(name, { needSize: need.unsized > 0 });
    watchStorage(result.status, { state, stop });
    // eslint-disable-next-line no-await-in-loop
    const applied = await applyRead(gallery._id, name, need, result, context);
    for (const [key, value] of Object.entries(applied)) {
      counts[key] = (counts[key] || 0) + value;
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

async function checkStorage({ collection }, read = readStoredFile) {
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

const sum = (totals, keys) =>
  keys.reduce((total, key) => total + (totals[key] || 0), 0);

// A run that could read nothing has not shown anything about the files: far
// more likely, it read the wrong storage (a shell without the application's
// storage settings reads the local disk).
function assessBackfill(totals) {
  const failures = [];
  const unread = sum(totals, [...TRANSIENT, ...PERMANENT]);
  const read = sum(totals, ['sized', 'dated', 'changedMeanwhile']);
  if (unread > 0 && read === 0 && !totals.storageVerified) {
    failures.push(
      `None of the ${unread} file(s) to read could be read. Check that ` +
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
  title: 'Gallery metadata backfill (dimensions and upload dates)',
  query: { files: { $elemMatch: { $or: [...LACKS_DIMENSIONS, LACKS_DATE] } } },
  projection: { creationOrWireframeId: 1, files: 1 },
  processGallery: backfillGallery,
  describeEnvironment: () => [describeStorage()],
  preflight: (context) => checkStorage(context),
  describeCounts: (counts, { dryRun }) =>
    `${counts.sized} sized and ${counts.dated} dated` +
    `${dryRun ? ' (to write)' : ''}, ${counts.known} already complete, ` +
    `${sum(counts, [...TRANSIENT, ...PERMANENT])} unreadable`,
  summarize: (totals, { dryRun }) => [
    [dryRun ? 'Dimensions to fill' : 'Dimensions filled', totals.sized],
    [dryRun ? 'Dates to fill' : 'Dates filled', totals.dated],
    ['Already complete', totals.known],
    ['Changed meanwhile', totals.changedMeanwhile],
    ['Missing from storage', totals[READ_STATUS.MISSING]],
    ['Not an image', totals[READ_STATUS.NOT_AN_IMAGE]],
    ['Size not found', totals[READ_STATUS.UNMEASURED]],
    ['Date not found', totals.undatable],
    ['Unusable name', totals[READ_STATUS.INVALID_NAME]],
    ['Read timed out', totals[READ_STATUS.TIMEOUT]],
    ['Storage error', totals[READ_STATUS.ERROR]],
  ],
  assess: assessBackfill,
};

if (require.main === module) {
  runFromCommandLine(backfill).catch(() => {
    // runFromCommandLine already reports any failure and sets the exit code.
  });
}

module.exports = {
  backfillGallery,
  assessBackfill,
  checkStorage,
  backfill,
  MAX_FAILED_READS_IN_A_ROW,
};
