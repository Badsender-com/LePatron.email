'use strict';

const {
  buildMigratedFiles,
  migrateGallery,
} = require('../../../packages/server/scripts/migrate-gallery-v1');

const MONGO_ID = '507f1f77bcf86cd799439011';
const GALLERY_CREATED_AT = new Date('2025-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// buildMigratedFiles — fonction pure
// ---------------------------------------------------------------------------

describe('buildMigratedFiles', () => {
  describe('idempotence', () => {
    it('skippe une image dont uploadedAt est déjà défini', () => {
      const existingDate = new Date('2026-01-01');
      const files = [
        { name: `${MONGO_ID}-hash.jpg`, uploadedAt: existingDate },
      ];

      const { migrated, skipped, updatedFiles } = buildMigratedFiles(
        files,
        GALLERY_CREATED_AT
      );

      expect(migrated).toBe(0);
      expect(skipped).toBe(1);
      expect(updatedFiles[0].uploadedAt).toEqual(existingDate);
    });

    it('migre une image sans uploadedAt', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg` }];

      const { migrated, skipped } = buildMigratedFiles(
        files,
        GALLERY_CREATED_AT
      );

      expect(migrated).toBe(1);
      expect(skipped).toBe(0);
    });
  });

  describe('uploadedAt', () => {
    it('initialise uploadedAt à gallery.createdAt', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg` }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].uploadedAt).toEqual(GALLERY_CREATED_AT);
    });
  });

  describe('label', () => {
    it('initialise label au nom technique si absent', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg` }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].label).toBe(`${MONGO_ID}-hash.jpg`);
    });

    it('préserve le label existant (même si c\'est le hash technique)', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg`, label: 'mon-logo.jpg' }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].label).toBe('mon-logo.jpg');
    });
  });

  describe('source et externalMetadata', () => {
    it('initialise source à "upload" si absent', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg` }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].source).toBe('upload');
    });

    it('préserve source si déjà défini', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg`, source: 'dam_bynder' }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].source).toBe('dam_bynder');
    });

    it('initialise externalMetadata à {} si absent', () => {
      const files = [{ name: `${MONGO_ID}-hash.jpg` }];

      const { updatedFiles } = buildMigratedFiles(files, GALLERY_CREATED_AT);

      expect(updatedFiles[0].externalMetadata).toEqual({});
    });
  });

  describe('galerie mixte', () => {
    it('migre uniquement les images sans uploadedAt', () => {
      const files = [
        { name: `${MONGO_ID}-aaa.jpg`, uploadedAt: new Date('2026-01-01') },
        { name: `${MONGO_ID}-bbb.jpg` },
        { name: `${MONGO_ID}-ccc.png` },
      ];

      const { migrated, skipped, updatedFiles } = buildMigratedFiles(
        files,
        GALLERY_CREATED_AT
      );

      expect(migrated).toBe(2);
      expect(skipped).toBe(1);
      expect(updatedFiles[0].uploadedAt).toEqual(new Date('2026-01-01'));
      expect(updatedFiles[1].uploadedAt).toEqual(GALLERY_CREATED_AT);
      expect(updatedFiles[2].uploadedAt).toEqual(GALLERY_CREATED_AT);
    });

    it('galerie vide → rien à faire', () => {
      const { updatedFiles, migrated, skipped } = buildMigratedFiles(
        [],
        GALLERY_CREATED_AT
      );

      expect(updatedFiles).toHaveLength(0);
      expect(migrated).toBe(0);
      expect(skipped).toBe(0);
    });

    it('toutes les images déjà migrées → 0 écriture', () => {
      const files = [
        { name: `${MONGO_ID}-aaa.jpg`, uploadedAt: new Date('2026-01-01') },
        { name: `${MONGO_ID}-bbb.jpg`, uploadedAt: new Date('2026-02-01') },
      ];

      const { migrated, skipped } = buildMigratedFiles(
        files,
        GALLERY_CREATED_AT
      );

      expect(migrated).toBe(0);
      expect(skipped).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// migrateGallery — avec mock de galerie Mongoose
// ---------------------------------------------------------------------------

describe('migrateGallery', () => {
  function makeMockGallery(files) {
    return {
      files,
      createdAt: GALLERY_CREATED_AT,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
  }

  it('sauvegarde la galerie quand des images sont migrées', async () => {
    const gallery = makeMockGallery([{ name: `${MONGO_ID}-hash.jpg` }]);

    const { migrated } = await migrateGallery(gallery, false);

    expect(migrated).toBe(1);
    expect(gallery.markModified).toHaveBeenCalledWith('files');
    expect(gallery.save).toHaveBeenCalled();
  });

  it('ne sauvegarde pas en mode dry-run', async () => {
    const gallery = makeMockGallery([{ name: `${MONGO_ID}-hash.jpg` }]);

    await migrateGallery(gallery, true);

    expect(gallery.save).not.toHaveBeenCalled();
  });

  it('ne sauvegarde pas si toutes les images sont déjà migrées', async () => {
    const gallery = makeMockGallery([
      { name: `${MONGO_ID}-hash.jpg`, uploadedAt: new Date() },
    ]);

    const { migrated, skipped } = await migrateGallery(gallery, false);

    expect(migrated).toBe(0);
    expect(skipped).toBe(1);
    expect(gallery.save).not.toHaveBeenCalled();
  });
});
