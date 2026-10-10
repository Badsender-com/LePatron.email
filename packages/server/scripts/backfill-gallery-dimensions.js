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
 * WARNING — run this while nobody is editing. Like migrate-gallery-v1.js, it
 * reads a gallery, changes it and writes it back. An upload overlapping that
 * read-modify-write makes one of the two saves fail; when it is the user's
 * upload that loses, their image is stored but never listed. See that script's
 * entry in README.md.
 */

const mongoose = require('mongoose');
const probe = require('probe-image-size');

const config = require('../node.config.js');
const { Galleries } = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');

const isDryRun = process.argv.includes('--dry-run');

// Enough for every image header we care about; the same budget the upload
// parser uses.
const SNIFF_BYTES = 4096;

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
    let settled = false;
    const chunks = [];
    let total = 0;

    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let stream;
    try {
      stream = fileManager.streamImage(imageName);
    } catch (error) {
      return done(null);
    }

    stream.on('error', () => done(null));
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= SNIFF_BYTES) {
        stream.destroy();
        finish();
      }
    });
    stream.on('end', finish);

    function finish() {
      try {
        const probed = probe.sync(Buffer.concat(chunks));
        done(
          probed && probed.width && probed.height
            ? { width: probed.width, height: probed.height }
            : null
        );
      } catch (error) {
        done(null);
      }
    }
  });
}

async function backfillGallery(gallery, dryRun) {
  const pending = gallery.files.filter(needsDimensions);
  const sizes = new Map();

  // Sequential on purpose: a gallery can hold hundreds of files, and the point
  // is not to be fast but to not hammer the storage backend during a window
  // where the application is also serving.
  for (const file of pending) {
    // eslint-disable-next-line no-await-in-loop
    const size = await readDimensions(file.name);
    if (size) sizes.set(file.name, size);
  }

  const result = buildBackfilledFiles(gallery.files, sizes);

  if (!dryRun && result.filled > 0) {
    gallery.files = result.updatedFiles;
    gallery.markModified('files');
    await gallery.save();
  }

  return result;
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
