'use strict';

const {
  needsDimensions,
  planGalleryBackfill,
  buildDimensionsUpdate,
  backfillGallery,
  assessBackfill,
  checkStorage,
  backfill,
} = require('../../scripts/backfill-gallery-dimensions.js');
const { READ_STATUS } = require('../../scripts/gallery/read-dimensions.js');

const sized = (name, width, height) => ({ name, label: name, width, height });
const unsized = (name) => ({ name, label: name });
const GALLERY_ID = 'gallery-id';

describe('backfill-gallery-dimensions', () => {
  describe('needsDimensions', () => {
    it('wants to read a file that has none', () => {
      expect(needsDimensions(unsized('a.png'))).toBe(true);
    });

    it('leaves a file that already has both', () => {
      expect(needsDimensions(sized('a.png', 800, 600))).toBe(false);
    });

    // A half-filled entry is as useless to the tooltip as an empty one.
    it('wants to read a file that has only one of the two', () => {
      expect(needsDimensions({ name: 'a.png', width: 800 })).toBe(true);
      expect(needsDimensions({ name: 'a.png', height: 600 })).toBe(true);
    });

    // 0 is not a dimension an image can have.
    it('treats a zero as missing', () => {
      expect(needsDimensions(sized('a.png', 0, 600))).toBe(true);
    });
  });

  describe('planGalleryBackfill', () => {
    it('plans each name to read once, counting its entries', () => {
      const plan = planGalleryBackfill([
        sized('known.png', 1, 1),
        unsized('dup.png'),
        unsized('dup.png'),
      ]);

      expect([...plan.pending]).toEqual([['dup.png', 2]]);
      expect(plan.known).toBe(1);
    });
  });

  describe('buildDimensionsUpdate', () => {
    const { filter, update, options } = buildDimensionsUpdate(
      GALLERY_ID,
      'a.png',
      { width: 10, height: 20 }
    );

    // A pair written meanwhile (an upload, another run) is not matched.
    it('only matches an entry still lacking its dimensions', () => {
      expect(filter._id).toBe(GALLERY_ID);
      expect(filter.files.$elemMatch.name).toBe('a.png');
      expect(filter.files.$elemMatch.$or).toHaveLength(2);
    });

    it('writes the pair only, on every entry of that name', () => {
      expect(update).toEqual({
        $set: { 'files.$[file].width': 10, 'files.$[file].height': 20 },
      });
      expect(options.arrayFilters[0]['file.name']).toBe('a.png');
    });
  });

  describe('backfillGallery', () => {
    const collection = { updateOne: jest.fn() };
    const log = jest.fn();
    const reads = (byName) =>
      jest.fn(async (name) => byName[name] || { status: READ_STATUS.MISSING });
    const run = (files, read, dryRun = false) =>
      backfillGallery(
        { _id: GALLERY_ID, files },
        { dryRun, collection, log, read }
      );

    beforeEach(() => {
      collection.updateOne.mockReset();
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      log.mockClear();
    });

    it('writes each pair it reads, and counts the writes', async () => {
      const read = reads({
        'a.png': { status: READ_STATUS.OK, width: 8, height: 6 },
      });

      const counts = await run([unsized('a.png'), sized('b.png', 1, 1)], read);

      expect(counts).toMatchObject({ filled: 1, known: 1 });
      expect(read).toHaveBeenCalledTimes(1);
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(collection.updateOne.mock.calls[0][1].$set).toEqual({
        'files.$[file].width': 8,
        'files.$[file].height': 6,
      });
    });

    it('reads but writes nothing in dry-run', async () => {
      const read = reads({
        'a.png': { status: READ_STATUS.OK, width: 8, height: 6 },
      });

      const counts = await run([unsized('a.png')], read, true);

      expect(counts.filled).toBe(1);
      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    // The operator must be able to look each one up.
    it('sorts what it could not read by reason, and names each file', async () => {
      const read = reads({
        'slow.png': { status: READ_STATUS.TIMEOUT },
        'denied.png': { status: READ_STATUS.ERROR, code: 'AccessDenied' },
        'doc.pdf': { status: READ_STATUS.NOT_AN_IMAGE },
        'big.jpg': { status: READ_STATUS.UNMEASURED },
      });

      const counts = await run(
        ['gone.png', 'slow.png', 'denied.png', 'doc.pdf', 'big.jpg'].map(
          unsized
        ),
        read
      );

      expect(counts).toMatchObject({
        [READ_STATUS.MISSING]: 1,
        [READ_STATUS.TIMEOUT]: 1,
        [READ_STATUS.ERROR]: 1,
        [READ_STATUS.NOT_AN_IMAGE]: 1,
        [READ_STATUS.UNMEASURED]: 1,
        filled: 0,
      });
      const logged = log.mock.calls.map(([line]) => line).join('\n');
      expect(logged).toContain('missing: "gone.png"');
      expect(logged).toContain('error (AccessDenied): "denied.png"');
      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    it('counts a file changed meanwhile apart from a write', async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const read = reads({
        'a.png': { status: READ_STATUS.OK, width: 8, height: 6 },
      });

      const counts = await run([unsized('a.png')], read);

      expect(counts).toMatchObject({ filled: 0, changedMeanwhile: 1 });
    });
  });

  describe('assessBackfill', () => {
    it('accepts a run that read something', () => {
      expect(assessBackfill({ filled: 3, missing: 2 })).toEqual([]);
    });

    // A shell without the storage settings reads the local disk: everything
    // comes out "missing", and that must not look like a success.
    it('refuses a run that could read nothing', () => {
      expect(assessBackfill({ filled: 0, missing: 40 })).toHaveLength(1);
    });

    // A rerun after a good run only meets the files that really are gone.
    it('accepts it once the storage was checked against a known file', () => {
      expect(assessBackfill({ missing: 4, storageVerified: 1 })).toEqual([]);
    });

    // A JPEG whose size could not be found is still an image: shown apart,
    // and no rerun will find it either.
    it('reports an unmeasured JPEG apart, without failing the run', () => {
      const totals = { filled: 3, [READ_STATUS.UNMEASURED]: 2 };

      expect(assessBackfill(totals)).toEqual([]);
      expect(backfill.summarize(totals, { dryRun: false })).toContainEqual([
        'Size not found',
        2,
      ]);
    });

    it('asks for a rerun after a timeout or a storage error', () => {
      const failures = assessBackfill({ filled: 9, timeout: 1, error: 1 });
      expect(failures.join()).toMatch(/2 read\(s\).*rerun/);
    });
  });

  describe('checkStorage', () => {
    const sampleOf = (names) => ({
      find: jest.fn(() => ({
        limit: () => ({
          toArray: async () => names.map((name) => ({ files: [{ name }] })),
        }),
      })),
    });

    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('passes when a file already measured reads back', async () => {
      const read = jest
        .fn()
        .mockResolvedValueOnce({ status: READ_STATUS.MISSING })
        .mockResolvedValueOnce({ status: READ_STATUS.OK, width: 1, height: 1 });

      const counts = await checkStorage(
        { collection: sampleOf(['a', 'b']) },
        read
      );

      expect(counts).toEqual({ storageVerified: 1 });
    });

    it('stops the run before any read when none does', async () => {
      const read = jest.fn().mockResolvedValue({ status: READ_STATUS.MISSING });

      await expect(
        checkStorage({ collection: sampleOf(['a', 'b', 'c']) }, read)
      ).rejects.toThrow(/storage check failed/);
    });

    it('has nothing to check on a base where nothing is measured yet', async () => {
      const read = jest.fn();

      await expect(
        checkStorage({ collection: sampleOf([]) }, read)
      ).resolves.toEqual({});
      expect(read).not.toHaveBeenCalled();
    });
  });

  it('selects the galleries holding a file without dimensions', () => {
    expect(backfill.query.files.$elemMatch.$or).toEqual([
      { width: { $in: [null, 0] } },
      { height: { $in: [null, 0] } },
    ]);
  });
});
