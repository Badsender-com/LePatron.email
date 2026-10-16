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
  // `.get(..., { getters: false })` reads what is stored, not what the schema
  // projects. The getter rebuilds each file onto a fixed set of keys, so
  // reading through it and saving the result back erased every field outside
  // that set — `originalName`, and anything a future integration adds.
  const files = gallery.get('files', null, { getters: false }) || [];
  const { updatedFiles, migrated, skipped } = buildMigratedFiles(
    files,
    gallery.createdAt
  );

  if (!dryRun && migrated > 0) {
    // One positional update per file rather than a rewrite of the whole
    // array: a rewrite also loses any upload that lands mid-run, which is what
    // made this script need a maintenance window.
    // Only the files this run actually changed: a positional update on an
    // already-migrated file would rewrite it with its own values for nothing.
    const toWrite = updatedFiles.filter(
      (file, index) => !files[index].uploadedAt
    );

    for (const file of toWrite) {
      // eslint-disable-next-line no-await-in-loop
      await Galleries.updateOne(
        {
          creationOrWireframeId: gallery.creationOrWireframeId,
          'files.name': file.name,
        },
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
