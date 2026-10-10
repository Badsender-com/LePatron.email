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
 *   node packages/server/scripts/backfill-gallery-dimensions.js [--dry-run]
 *
 * Reads only the head of each file, not the whole image. Idempotent: a file
 * that already has dimensions is skipped, so an interrupted run resumes.
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

const mongoose = require('mongoose');

const config = require('../node.config.js');
const { Galleries } = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');

const isDryRun = process.argv.includes('--dry-run');

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
      done(fileManager.probeImageDimensions(Buffer.concat(chunks)));
    }
  });
}

async function backfillGallery(gallery, dryRun) {
  // `.get(..., { getters: false })` reads what is stored, not what the schema
  // projects — the projection is missing fields this script must not erase.
  const files = gallery.get('files', null, { getters: false }) || [];
  const pending = files.filter(needsDimensions);
  const sizes = new Map();

  // Sequential on purpose: a gallery can hold hundreds of files, and the point
  // is not to be fast but to not hammer the storage backend.
  for (const file of pending) {
    // eslint-disable-next-line no-await-in-loop
    const size = await readDimensions(file.name);
    if (size) sizes.set(file.name, size);
  }

  if (!dryRun) {
    for (const [name, size] of sizes) {
      // eslint-disable-next-line no-await-in-loop
      await Galleries.updateOne(
        {
          creationOrWireframeId: gallery.creationOrWireframeId,
          'files.name': name,
        },
        { $set: { 'files.$.width': size.width, 'files.$.height': size.height } }
      );
    }
  }

  return buildBackfilledFiles(files, sizes);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  const dbUri = process.env.MONGODB_URI || config.database;
  mongoose.set('useFindAndModify', false);
  mongoose.set('useCreateIndex', true);
  await mongoose.connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`Connected to: ${dbUri}`);

  if (isDryRun) {
    console.log('[DRY-RUN] Simulation — nothing is written.\n');
  }

  const totalGalleries = await Galleries.countDocuments();
  console.log('Gallery dimensions backfill');
  console.log(`Galleries: ${totalGalleries}\n`);

  let galleryCount = 0;
  let totalFilled = 0;
  let totalSkipped = 0;
  let totalUnreadable = 0;
  let totalErrors = 0;

  const cursor = Galleries.find({}).cursor();

  for (
    let gallery = await cursor.next();
    gallery !== null;
    gallery = await cursor.next()
  ) {
    galleryCount++;
    const galleryId = String(gallery.creationOrWireframeId);

    try {
      // eslint-disable-next-line no-await-in-loop
      const { filled, skipped, unreadable } = await backfillGallery(
        gallery,
        isDryRun
      );
      totalFilled += filled;
      totalSkipped += skipped;
      totalUnreadable += unreadable;

      console.log(
        `[${galleryCount}/${totalGalleries}] ${galleryId} — ` +
          `${filled} filled, ${skipped} already known, ${unreadable} unreadable`
      );
    } catch (error) {
      totalErrors++;
      console.error(
        `[${galleryCount}/${totalGalleries}] ${galleryId} — ERROR: ${error.message}`
      );
    }
  }

  console.log('\n--- Result ---');
  console.log(`Galleries processed : ${galleryCount}/${totalGalleries}`);
  console.log(`Dimensions filled   : ${totalFilled}`);
  console.log(`Already known       : ${totalSkipped}`);
  console.log(`Unreadable          : ${totalUnreadable}`);
  if (totalErrors > 0) console.error(`Errors              : ${totalErrors}`);
  if (totalUnreadable > 0) {
    console.log(
      '\nUnreadable files are listed in the gallery but missing from storage, ' +
        'or are not images. Their tooltip shows no dimensions; nothing else breaks.'
    );
  }
  if (isDryRun) console.log('\n[DRY-RUN] Nothing was written.');

  await mongoose.disconnect();
}

// only run when executed directly, not when required by a test
if (require.main === module) {
  run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { needsDimensions, buildBackfilledFiles, readDimensions };
