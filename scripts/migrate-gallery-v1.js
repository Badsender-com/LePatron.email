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

// ---------------------------------------------------------------------------
// Pure logic, testable without a database
// ---------------------------------------------------------------------------

function buildMigratedFiles(files, galleryCreatedAt) {
  let migrated = 0;
  let skipped = 0;

  const updatedFiles = files.map((file) => {
    if (file.uploadedAt) {
      skipped++;
      return file;
    }
    migrated++;
    return {
      ...file,
      label: file.label || file.name,
      source: file.source || 'upload',
      externalMetadata: file.externalMetadata || {},
      uploadedAt: galleryCreatedAt,
    };
  });

  return { updatedFiles, migrated, skipped };
}

// The gallery is read raw (no Mongoose document, so no schema getter): the
// getter projects each file onto a fixed set of keys, and writing that
// projection back is how a first version erased `originalName`.
async function migrateGallery(gallery, { dryRun, collection }) {
  const files = gallery.files || [];
  const { updatedFiles, migrated, skipped } = buildMigratedFiles(
    files,
    gallery.createdAt
  );

  if (!dryRun && migrated > 0) {
    // One positional update per file rather than a rewrite of the whole
    // array: a rewrite also loses any upload that lands mid-run.
    const toWrite = updatedFiles.filter(
      (file, index) => !files[index].uploadedAt
    );
    for (const file of toWrite) {
      // eslint-disable-next-line no-await-in-loop
      await collection.updateOne(
        { _id: gallery._id, 'files.name': file.name },
        {
          $set: {
            'files.$.label': file.label,
            'files.$.source': file.source,
            'files.$.externalMetadata': file.externalMetadata,
            'files.$.uploadedAt': file.uploadedAt,
          },
        }
      );
    }
  }

  return { migrated, skipped };
}

const migration = {
  title: 'Gallery V1 migration',
  query: { files: { $elemMatch: { uploadedAt: null } } },
  projection: { creationOrWireframeId: 1, createdAt: 1, files: 1 },
  processGallery: migrateGallery,
  describeCounts: ({ migrated, skipped }) =>
    `${migrated} migrated, ${skipped} already up to date`,
  summarize: (totals, { dryRun }) => [
    `Images ${dryRun ? 'to migrate' : 'migrated'}    : ${totals.migrated || 0}`,
    `Already up to date  : ${totals.skipped || 0}`,
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

module.exports = { buildMigratedFiles, migrateGallery, migration };
