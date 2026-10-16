#!/usr/bin/env node
'use strict';

/**
 * One-shot backfill — gallery image dimensions (US-09)
 *
 * The gallery tooltip shows an image's original dimensions. Uploads have
 * carried them since US-09, but everything stored before that has not: the
 * dimensions cannot be recovered from the thumbnail, which is a square 111px
 * crop. So each stored file is read back and probed.
 *
 * Usage:
 *   node scripts/backfill-gallery-dimensions.js [--dry-run] [--concurrency=N]
 *
 * Reads only the head of each file, not the whole image. Rerunnable: a file
 * that already has dimensions is skipped, so an interrupted run resumes.
 * See scripts/gallery/README.md before running it on production.
 *
 * Writes one field pair at a time, through a positional update that touches
 * nothing else in the document. Reading `gallery.files` and saving it back
 * would be the obvious shape and is the wrong one twice over: the schema's
 * getter PROJECTS each file onto a fixed set of keys, so writing that
 * projection back silently drops everything else it holds; and rewriting the
 * whole array loses any upload that landed while the script was reading.
 * Neither failure announces itself.
 *
 * Safe to run while the application is serving.
 */

const path = require('path');

require('dotenv').config();
const fileManager = require('../packages/server/common/file-manage.service.js');
const uploadIdentity = require('../packages/server/common/upload-identity.service.js');
const { runGalleryScript } = require('./gallery/run-gallery-script.js');

// Pull enough for the shared reader to reach a JPEG's SOF0 behind a maximal
// EXIF segment. It caps what it hands the prober itself, so reading more here
// is safe.
const READ_BYTES = 128 * 1024;

// A stalled storage read — the ordinary way a flaky S3 connection fails — would
// otherwise hang the whole run at file k of n, with no output and no exit.
const READ_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Pure logic — testable without a database or a storage backend
// ---------------------------------------------------------------------------

/**
 * @param {object} file a gallery file as stored
 * @returns {boolean} whether this one still needs reading
 */
function needsDimensions(file) {
  return !file.width || !file.height;
}

/**
 * @param {Array<object>} files
 * @param {Map<string, {width: number, height: number}>} sizes by file name
 * @returns {{updatedFiles: Array<object>, filled: number, skipped: number, unreadable: number}}
 */
function buildBackfilledFiles(files, sizes) {
  let filled = 0;
  let skipped = 0;
  let unreadable = 0;

  const updatedFiles = files.map((file) => {
    if (!needsDimensions(file)) {
      skipped++;
      return file;
    }
    const size = sizes.get(file.name);
    if (!size) {
      unreadable++;
      return file;
    }
    filled++;
    return { ...file, width: size.width, height: size.height };
  });

  return { updatedFiles, filled, skipped, unreadable };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

// Reads just the head of a stored file and probes it. Resolves to null for
// anything unreadable or not an image — a gallery can reference a file that no
// longer exists in storage, and that must not stop the run.
function readDimensions(imageName) {
  return new Promise((resolve) => {
    // Names are server-generated, but this script walks every record in the
    // collection — including anything a DAM import or a direct write put
    // there — and feeds them to a path join.
    if (!imageName || path.basename(imageName) !== imageName) {
      return resolve(null);
    }

    let settled = false;
    let timer = null;
    const chunks = [];
    let total = 0;

    const done = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    let stream;
    try {
      stream = fileManager.streamImage(imageName);
    } catch (error) {
      return done(null);
    }

    timer = setTimeout(() => {
      done(null);
      stream.destroy();
    }, READ_TIMEOUT_MS);

    stream.on('error', () => done(null));
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= READ_BYTES) {
        // Settle BEFORE destroying: on S3 `destroy` aborts the request, which
        // emits `error` — and the error handler would win the race and report
        // every single file as unreadable.
        finish();
        stream.destroy();
      }
    });
    stream.on('end', finish);

    function finish() {
      // the shared reader caps what it hands the prober and rounds the result
      done(uploadIdentity.probeImageDimensions(Buffer.concat(chunks)));
    }
  });
}

// The gallery is read raw (no Mongoose document, so no schema getter): the
// projection is missing fields this script must not erase. Each pair is
// written as soon as it is read, so an interruption loses at most one read.
async function backfillGallery(gallery, { dryRun, collection }) {
  const files = gallery.files || [];
  const pending = files.filter(needsDimensions);
  const sizes = new Map();

  // Sequential within a gallery: the runner bounds how many galleries run at
  // once, so the storage never sees more reads than that.
  for (const file of pending) {
    // eslint-disable-next-line no-await-in-loop
    const size = await readDimensions(file.name);
    if (!size) continue;
    sizes.set(file.name, size);
    if (dryRun) continue;
    // eslint-disable-next-line no-await-in-loop
    await collection.updateOne(
      { _id: gallery._id, 'files.name': file.name },
      { $set: { 'files.$.width': size.width, 'files.$.height': size.height } }
    );
  }

  const { filled, skipped, unreadable } = buildBackfilledFiles(files, sizes);
  return { filled, skipped, unreadable };
}

const backfill = {
  title: 'Gallery dimensions backfill',
  query: {
    files: {
      $elemMatch: {
        $or: [{ width: { $in: [null, 0] } }, { height: { $in: [null, 0] } }],
      },
    },
  },
  projection: { creationOrWireframeId: 1, files: 1 },
  processGallery: backfillGallery,
  describeCounts: ({ filled, skipped, unreadable }) =>
    `${filled} filled, ${skipped} already known, ${unreadable} unreadable`,
  summarize: (totals, { dryRun }) => [
    `Dimensions ${dryRun ? 'to fill' : 'filled'}   : ${totals.filled || 0}`,
    `Already known       : ${totals.skipped || 0}`,
    `Unreadable          : ${totals.unreadable || 0}`,
  ],
};

// only run when executed directly, not when required by a test
if (require.main === module) {
  runGalleryScript(backfill).then(
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
  needsDimensions,
  buildBackfilledFiles,
  readDimensions,
  backfillGallery,
  backfill,
};
