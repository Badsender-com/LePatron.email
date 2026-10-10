'use strict';

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Galleries: { updateOne: jest.fn().mockResolvedValue({}) },
}));

const {
  Galleries,
} = require('../../../packages/server/common/models.common.js');
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

    it("préserve le label existant (même si c'est le hash technique)", () => {
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
  // A mongoose document, not a plain object: reading `gallery.files` runs the
  // schema getter, which PROJECTS each file onto a fixed set of keys. The
  // first version of this script read through that projection and saved it
  // back, which silently erased every stored field outside it.
  function makeMockGallery(stored) {
    const projected = stored.map((file) => ({
      name: file.name,
      url: file.name,
      deleteUrl: `/api/images/${file.name}`,
      thumbnailUrl: `/api/images/cover/111x111/${file.name}`,
      label: file.label || file.name,
      source: file.source || 'upload',
      externalMetadata: file.externalMetadata || {},
      uploadedAt: file.uploadedAt || null,
    }));
    return {
      creationOrWireframeId: MONGO_ID,
      // what a reader going through the getter would see
      files: projected,
      // what is actually stored
      get: (path, type, options) =>
        path === 'files' && options && options.getters === false
          ? stored
          : projected,
      createdAt: GALLERY_CREATED_AT,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
  }

  beforeEach(() => Galleries.updateOne.mockClear());

  it('fills the V1 fields of an image that has none', async () => {
    const gallery = makeMockGallery([{ name: `${MONGO_ID}-hash.jpg` }]);

    const { migrated } = await migrateGallery(gallery, false);

    expect(migrated).toBe(1);
    expect(Galleries.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = Galleries.updateOne.mock.calls[0];
    expect(filter).toEqual({
      creationOrWireframeId: MONGO_ID,
      'files.name': `${MONGO_ID}-hash.jpg`,
    });
    expect(Object.keys(update.$set).sort()).toEqual([
      'files.$.externalMetadata',
      'files.$.label',
      'files.$.source',
      'files.$.uploadedAt',
    ]);
  });

  // The defect this rewrite exists for. A field the schema getter does not
  // list used to be destroyed on every gallery the script touched — silently,
  // in a one-shot script meant to run on production.
  it('reads what is stored, not what the schema projects', async () => {
    const gallery = makeMockGallery([
      {
        name: `${MONGO_ID}-hash.jpg`,
        originalName: 'mon-image.jpg',
        somethingAnIntegrationAdded: 'keep me',
      },
    ]);

    await migrateGallery(gallery, false);

    // it never rewrites the array, so nothing outside the two touched fields
    // can be lost
    expect(gallery.save).not.toHaveBeenCalled();
    expect(gallery.markModified).not.toHaveBeenCalled();
    const [, update] = Galleries.updateOne.mock.calls[0];
    expect(Object.keys(update.$set)).not.toContain('files');
  });

  // One update per file it actually changed. Touching the already-migrated
  // ones would rewrite them with their own values, for nothing.
  it('only writes the images it migrated, in a mixed gallery', async () => {
    const gallery = makeMockGallery([
      { name: `${MONGO_ID}-aaa.jpg`, uploadedAt: new Date('2026-01-01') },
      { name: `${MONGO_ID}-bbb.jpg` },
    ]);

    const { migrated, skipped } = await migrateGallery(gallery, false);

    expect(migrated).toBe(1);
    expect(skipped).toBe(1);
    expect(Galleries.updateOne).toHaveBeenCalledTimes(1);
    expect(Galleries.updateOne.mock.calls[0][0]['files.name']).toBe(
      `${MONGO_ID}-bbb.jpg`
    );
  });

  it('writes nothing in dry-run', async () => {
    const gallery = makeMockGallery([{ name: `${MONGO_ID}-hash.jpg` }]);

    await migrateGallery(gallery, true);

    expect(Galleries.updateOne).not.toHaveBeenCalled();
    expect(gallery.save).not.toHaveBeenCalled();
  });

  it('writes nothing when every image is already migrated', async () => {
    const gallery = makeMockGallery([
      { name: `${MONGO_ID}-hash.jpg`, uploadedAt: new Date() },
    ]);

    const { migrated, skipped } = await migrateGallery(gallery, false);

    expect(migrated).toBe(0);
    expect(skipped).toBe(1);
    expect(Galleries.updateOne).not.toHaveBeenCalled();
  });
});
