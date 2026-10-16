'use strict';

const { Types } = require('mongoose');

const {
  migrationDate,
  planGalleryMigration,
  buildMigrationUpdate,
  migrateGallery,
  migration,
} = require('../../scripts/migrate-gallery-v1');

const MONGO_ID = '507f1f77bcf86cd799439011';
const GALLERY_ID = new Types.ObjectId('5f0c1f77bcf86cd799439022');
const GALLERY_CREATED_AT = new Date('2025-06-01T10:00:00.000Z');
const file = (suffix, fields = {}) => ({
  name: `${MONGO_ID}-${suffix}.jpg`,
  ...fields,
});

describe('migrate-gallery-v1', () => {
  describe('planGalleryMigration', () => {
    it('plans an image without uploadedAt, skips one that has it', () => {
      const plan = planGalleryMigration([
        file('done', { uploadedAt: new Date('2026-01-01') }),
        file('todo'),
      ]);

      expect([...plan.pending]).toEqual([[`${MONGO_ID}-todo.jpg`, 1]]);
      expect(plan.upToDate).toBe(1);
    });

    // What the first version wrote when a gallery had no createdAt.
    it('treats a null uploadedAt as not migrated', () => {
      const plan = planGalleryMigration([file('a', { uploadedAt: null })]);
      expect(plan.pending.size).toBe(1);
    });

    // Legacy saves could push the same name twice; one update covers both.
    it('plans a duplicated name once, counting its entries', () => {
      const plan = planGalleryMigration([file('dup'), file('dup')]);
      expect([...plan.pending]).toEqual([[`${MONGO_ID}-dup.jpg`, 2]]);
    });

    // A stored name goes into a query: an object there would be an operator.
    it('leaves out a name that is not a string', () => {
      const plan = planGalleryMigration([{ name: { $gt: '' } }, { name: '' }]);
      expect(plan.pending.size).toBe(0);
      expect(plan.invalid).toBe(2);
    });

    it('has nothing to do on an empty gallery', () => {
      expect(planGalleryMigration([])).toEqual({
        pending: new Map(),
        upToDate: 0,
        invalid: 0,
      });
    });
  });

  describe('migrationDate', () => {
    it('dates the images from the gallery creation', () => {
      expect(migrationDate({ createdAt: GALLERY_CREATED_AT })).toBe(
        GALLERY_CREATED_AT
      );
    });

    // A null uploadedAt would make the image "not migrated" forever.
    it('falls back on the ObjectId timestamp, never on null', () => {
      expect(migrationDate({ _id: GALLERY_ID })).toEqual(
        GALLERY_ID.getTimestamp()
      );
    });

    it('refuses a gallery it cannot date', () => {
      expect(() => migrationDate({ _id: 'hand-written' })).toThrow();
    });
  });

  describe('buildMigrationUpdate', () => {
    const name = `${MONGO_ID}-a.jpg`;
    const { filter, update, options } = buildMigrationUpdate(
      GALLERY_ID,
      name,
      GALLERY_CREATED_AT
    );

    // The precondition is part of the write: an image migrated or removed
    // between the read and the update is not matched.
    it('only matches a gallery where the image is still not migrated', () => {
      expect(filter).toEqual({
        _id: GALLERY_ID,
        files: { $elemMatch: { name, uploadedAt: null } },
      });
    });

    it('sets the four V1 fields, on every entry of that name', () => {
      expect(update.$set).toEqual({
        'files.$[file].uploadedAt': GALLERY_CREATED_AT,
        'files.$[unlabelled].label': name,
        'files.$[unsourced].source': 'upload',
        'files.$[bare].externalMetadata': {},
      });
      expect(JSON.stringify(update)).not.toContain('files.$.');
    });

    // A user renaming the image while the script runs keeps the label typed.
    it('never overwrites a label, a source or metadata already there', () => {
      const [, unlabelled, unsourced, bare] = options.arrayFilters;
      expect(unlabelled).toMatchObject({
        'unlabelled.name': name,
        'unlabelled.uploadedAt': null,
        'unlabelled.label': { $in: [null, ''] },
      });
      expect(unsourced['unsourced.source']).toEqual({ $in: [null, ''] });
      expect(bare['bare.externalMetadata']).toBeNull();
    });
  });

  describe('migrateGallery', () => {
    const collection = { updateOne: jest.fn() };
    const log = jest.fn();
    const run = (files, dryRun = false, extra = {}) =>
      migrateGallery(
        {
          _id: GALLERY_ID,
          creationOrWireframeId: MONGO_ID,
          createdAt: GALLERY_CREATED_AT,
          files,
          ...extra,
        },
        { dryRun, collection, log }
      );

    beforeEach(() => {
      collection.updateOne.mockReset();
      collection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });
      log.mockClear();
    });

    it('writes one update per name still to migrate, and counts it', async () => {
      const counts = await run([
        file('done', { uploadedAt: new Date('2026-01-01') }),
        file('todo'),
      ]);

      expect(counts).toMatchObject({ migrated: 1, upToDate: 1 });
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(collection.updateOne.mock.calls[0][0].files.$elemMatch.name).toBe(
        `${MONGO_ID}-todo.jpg`
      );
    });

    // The count is what was written, not what was meant.
    it('counts an image changed meanwhile apart, and names it', async () => {
      collection.updateOne.mockResolvedValue({
        matchedCount: 0,
        modifiedCount: 0,
      });

      const counts = await run([file('gone')]);

      expect(counts).toMatchObject({ migrated: 0, changedMeanwhile: 1 });
      expect(log.mock.calls[0][0]).toContain(`${MONGO_ID}-gone.jpg`);
    });

    it('counts both entries of a duplicated name with one write', async () => {
      const counts = await run([file('dup'), file('dup')]);

      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(counts.migrated).toBe(2);
    });

    it('writes nothing in dry-run, and says what it would do', async () => {
      const counts = await run([file('a'), file('b')], true);

      expect(collection.updateOne).not.toHaveBeenCalled();
      expect(counts.migrated).toBe(2);
    });

    it('writes nothing when every image is already migrated', async () => {
      const counts = await run([file('a', { uploadedAt: new Date() })]);

      expect(collection.updateOne).not.toHaveBeenCalled();
      expect(counts).toMatchObject({ migrated: 0, upToDate: 1 });
    });

    it('fails the gallery rather than write a null date', async () => {
      await expect(
        run([file('a')], false, { _id: 'hand-written', createdAt: undefined })
      ).rejects.toThrow(/createdAt/);
      expect(collection.updateOne).not.toHaveBeenCalled();
    });
  });

  // The runner reads only what the query matches: it must match exactly the
  // galleries planGalleryMigration has work for.
  it('selects the galleries holding an image without uploadedAt', () => {
    expect(migration.query).toEqual({
      files: { $elemMatch: { uploadedAt: null } },
    });
  });
});
