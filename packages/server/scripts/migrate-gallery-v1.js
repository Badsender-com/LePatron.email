'use strict';

/**
 * Migration one-shot — galerie V1
 *
 * Backfille label, source, externalMetadata et uploadedAt sur toutes les
 * images existantes qui n'ont pas encore uploadedAt défini.
 *
 * Usage :
 *   node packages/server/scripts/migrate-gallery-v1.js [--dry-run]
 */

const mongoose = require('mongoose');

const config = require('../node.config.js');
const { Galleries } = require('../common/models.common.js');

const BATCH_SIZE = 10;
const isDryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Logique pure — testable sans base de données
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

async function migrateGallery(gallery, dryRun) {
  const { updatedFiles, migrated, skipped } = buildMigratedFiles(
    gallery.files,
    gallery.createdAt
  );

  if (!dryRun && migrated > 0) {
    gallery.files = updatedFiles;
    gallery.markModified('files');
    await gallery.save();
  }

  return { migrated, skipped };
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

async function run() {
  mongoose.set('useFindAndModify', false);
  mongoose.set('useCreateIndex', true);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  if (isDryRun) {
    console.log('[DRY-RUN] Mode simulation — aucune écriture en base.\n');
  }

  const totalGalleries = await Galleries.countDocuments();
  const allGalleriesLean = await Galleries.find({}, 'files').lean();
  const totalImages = allGalleriesLean.reduce(
    (sum, g) => sum + g.files.length,
    0
  );

  console.log('Migration galerie V1');
  console.log(
    `Galeries : ${totalGalleries} | Images totales : ${totalImages}\n`
  );

  let galleryCount = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const cursor = Galleries.find({}).cursor();
  let batch = [];

  const processBatch = async (galleries) => {
    for (const gallery of galleries) {
      galleryCount++;
      const galleryId = String(gallery.creationOrWireframeId);

      try {
        const { migrated, skipped } = await migrateGallery(gallery, isDryRun);
        totalMigrated += migrated;
        totalSkipped += skipped;

        console.log(
          `[${galleryCount}/${totalGalleries}] ${galleryId} — ` +
            `${migrated} migrée(s), ${skipped} déjà à jour`
        );
      } catch (err) {
        totalErrors++;
        console.error(
          `[${galleryCount}/${totalGalleries}] ${galleryId} — ERREUR : ${err.message}`
        );
      }
    }
  };

  for (
    let gallery = await cursor.next();
    gallery !== null;
    gallery = await cursor.next()
  ) {
    batch.push(gallery);
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
  }

  console.log('\n--- Résultat ---');
  console.log(`Galeries traitées : ${galleryCount}/${totalGalleries}`);
  console.log(`Images migrées    : ${totalMigrated}`);
  console.log(`Images skippées   : ${totalSkipped}`);
  if (totalErrors > 0) {
    console.error(`Erreurs           : ${totalErrors}`);
  }
  if (isDryRun) {
    console.log('\n[DRY-RUN] Aucune modification appliquée.');
  }

  await mongoose.disconnect();
}

// Lance le script uniquement si exécuté directement (pas lors des require en tests)
if (require.main === module) {
  run().catch((err) => {
    console.error('Erreur fatale :', err);
    process.exit(1);
  });
}

module.exports = { buildMigratedFiles, migrateGallery };
