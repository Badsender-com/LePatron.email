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
  const dbUri = process.env.MONGODB_URI || config.database;
  mongoose.set('useFindAndModify', false);
  mongoose.set('useCreateIndex', true);
  await mongoose.connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`Connecté à : ${dbUri}`);

  if (isDryRun) {
    console.log('[DRY-RUN] Mode simulation — aucune écriture en base.\n');
  }

  const totalGalleries = await Galleries.countDocuments();

  console.log('Migration galerie V1');
  console.log(`Galeries : ${totalGalleries}\n`);

  let galleryCount = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Stream galleries one by one — the cursor keeps memory flat even on a
  // large collection. Each gallery is saved sequentially, so there is no
  // throughput gain in buffering a batch.
  const cursor = Galleries.find({}).cursor();

  for (
    let gallery = await cursor.next();
    gallery !== null;
    gallery = await cursor.next()
  ) {
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

  console.log('\n--- Résultat ---');
  console.log(`Galeries traitées : ${galleryCount}/${totalGalleries}`);
  console.log(`Images totales    : ${totalMigrated + totalSkipped}`);
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
