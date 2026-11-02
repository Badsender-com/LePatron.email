'use strict';

const {
  needsDimensions,
  planGalleryBackfill,
  buildDimensionsUpdate,
  buildDateUpdate,
} = require('../../scripts/gallery/backfill-plan.js');
const {
  backfillGallery,
  assessBackfill,
  checkStorage,
  backfill,
  MAX_FAILED_READS_IN_A_ROW,
} = require('../../scripts/backfill-gallery-metadata.js');
const { READ_STATUS } = require('../../scripts/gallery/read-stored-file.js');

const STORED_AT = new Date('2021-03-04T05:06:07Z');
const UPLOADED_AT = new Date('2024-01-02T03:04:05Z');
// complete: nothing left to fill
const sized = (name, width, height) => ({
  name,
  label: name,
  width,
  height,
  uploadedAt: UPLOADED_AT,
});
// lacks both its dimensions and its date
const unsized = (name) => ({ name, label: name });
const GALLERY_ID = 'gallery-id';

describe('backfill-gallery-metadata', () => {
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

      expect([...plan.pending]).toEqual([
        ['dup.png', { entries: 2, unsized: 2, undated: 2 }],
      ]);
      expect(plan.known).toBe(1);
    });

    it('counts what each entry lacks, dimensions or date', () => {
      const plan = planGalleryBackfill([
        { name: 'dated.png', uploadedAt: UPLOADED_AT },
        { name: 'sized.png', width: 8, height: 6 },
        { name: 'sized.png', width: 8, height: 6, uploadedAt: null },
      ]);

      expect(plan.pending.get('dated.png')).toEqual({
        entries: 1,
        unsized: 1,
        undated: 0,
      });
      expect(plan.pending.get('sized.png')).toEqual({
        entries: 2,
        unsized: 0,
        undated: 2,
      });
    });
  });

  describe('buildDateUpdate', () => {
    const { filter, update, options } = buildDateUpdate(
      GALLERY_ID,
      'a.png',
      STORED_AT
    );

    // A date written meanwhile (an upload, another run) is never replaced.
    it('only matches an entry still without a date', () => {
      expect(filter).toEqual({
        _id: GALLERY_ID,
        files: { $elemMatch: { name: 'a.png', uploadedAt: null } },
      });
      expect(options.arrayFilters).toEqual([
        { 'file.name': 'a.png', 'file.uploadedAt': null },
      ]);
    });

    it('writes the date only, on every entry of that name', () => {
      expect(update).toEqual({
        $set: { 'files.$[file].uploadedAt': STORED_AT },
      });
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
    const run = (files, read, dryRun = false, extra = {}) =>
      backfillGallery(
        { _id: GALLERY_ID, files },
        { dryRun, collection, log, read, ...extra }
      );
    const names = (count) =>
      Array.from({ length: count }, (_, i) => unsized(`${i}.png`));
    // what the runner hands every gallery of one run
    const runContext = () => {
      const context = { state: {}, stopped: null };
      context.stop = jest.fn((reason) => {
        context.stopped = reason;
      });
      context.isStopping = () => context.stopped !== null;
      return context;
    };

    beforeEach(() => {
      collection.updateOne.mockReset();
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      log.mockClear();
    });

    const setOf = (call) => collection.updateOne.mock.calls[call][1].$set;

    it('writes the pair and the storage date it reads, and counts each', async () => {
      const read = reads({
        'a.png': {
          status: READ_STATUS.OK,
          width: 8,
          height: 6,
          storedAt: STORED_AT,
        },
      });

      const counts = await run([unsized('a.png'), sized('b.png', 1, 1)], read);

      expect(counts).toMatchObject({ sized: 1, dated: 1, known: 1 });
      expect(read).toHaveBeenCalledTimes(1);
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
      expect(setOf(0)).toEqual({
        'files.$[file].width': 8,
        'files.$[file].height': 6,
      });
      expect(setOf(1)).toEqual({ 'files.$[file].uploadedAt': STORED_AT });
    });

    // An image already measured only needs its date: no need to read its
    // bytes, the storage answers the date with its headers.
    it('reads only the date of an image already measured', async () => {
      const read = jest.fn(async () => ({
        status: READ_STATUS.OK,
        storedAt: STORED_AT,
      }));

      const counts = await run([{ name: 'a.png', width: 8, height: 6 }], read);

      expect(read).toHaveBeenCalledWith('a.png', { needSize: false });
      expect(counts).toMatchObject({ sized: 0, dated: 1 });
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(setOf(0)).toEqual({ 'files.$[file].uploadedAt': STORED_AT });
    });

    // A date is never invented: the image stays without one.
    it('leaves an image undated when the storage gives no date', async () => {
      const read = reads({
        'a.png': { status: READ_STATUS.OK, width: 8, height: 6 },
      });

      const counts = await run([unsized('a.png')], read);

      expect(counts).toMatchObject({ sized: 1, dated: 0, undatable: 1 });
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(setOf(0)).not.toHaveProperty(['files.$[file].uploadedAt']);
    });

    it('still dates a stored file it cannot measure', async () => {
      const read = reads({
        'doc.pdf': { status: READ_STATUS.NOT_AN_IMAGE, storedAt: STORED_AT },
      });

      const counts = await run([unsized('doc.pdf')], read);

      expect(counts).toMatchObject({
        [READ_STATUS.NOT_AN_IMAGE]: 1,
        sized: 0,
        dated: 1,
      });
      expect(setOf(0)).toEqual({ 'files.$[file].uploadedAt': STORED_AT });
    });

    it('reads but writes nothing in dry-run, and counts both fields', async () => {
      const read = reads({
        'a.png': {
          status: READ_STATUS.OK,
          width: 8,
          height: 6,
          storedAt: STORED_AT,
        },
      });

      const counts = await run([unsized('a.png')], read, true);

      expect(counts).toMatchObject({ sized: 1, dated: 1 });
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
        sized: 0,
        dated: 0,
      });
      const logged = log.mock.calls.map(([line]) => line).join('\n');
      expect(logged).toContain('missing: "gone.png"');
      expect(logged).toContain('error (AccessDenied): "denied.png"');
      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    // An interrupt must not wait for every file left in the gallery.
    it('reads no further file once the run is stopping', async () => {
      const context = runContext();
      const read = jest.fn(async () => {
        context.stop('interrupted');
        return { status: READ_STATUS.MISSING };
      });

      await run(names(5), read, false, context);

      expect(read).toHaveBeenCalledTimes(1);
    });

    // A storage that stalls costs a timeout per file: stop instead of walking
    // the whole collection at that pace.
    it('stops the run after a streak of failed reads', async () => {
      const context = runContext();
      const read = jest.fn(async () => ({ status: READ_STATUS.TIMEOUT }));

      await run(names(MAX_FAILED_READS_IN_A_ROW + 5), read, false, context);

      expect(read).toHaveBeenCalledTimes(MAX_FAILED_READS_IN_A_ROW);
      expect(context.stop).toHaveBeenCalledTimes(1);
      expect(context.stopped).toMatch(/storage/);
    });

    it('counts the streak across galleries, and resets it on an answer', async () => {
      const context = runContext();
      const failing = jest.fn(async () => ({ status: READ_STATUS.ERROR }));
      const answering = reads({});

      await run(names(MAX_FAILED_READS_IN_A_ROW - 1), failing, false, context);
      await run(names(1), answering, false, context);
      await run(names(MAX_FAILED_READS_IN_A_ROW - 1), failing, false, context);
      expect(context.stop).not.toHaveBeenCalled();

      await run(names(1), failing, false, context);
      expect(context.stop).toHaveBeenCalledTimes(1);
    });

    it('counts a field changed meanwhile apart from a write', async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const read = reads({
        'a.png': {
          status: READ_STATUS.OK,
          width: 8,
          height: 6,
          storedAt: STORED_AT,
        },
      });

      const counts = await run([unsized('a.png')], read);

      expect(counts).toMatchObject({ sized: 0, dated: 0, changedMeanwhile: 2 });
    });
  });

  describe('assessBackfill', () => {
    it('accepts a run that read something', () => {
      expect(assessBackfill({ sized: 3, missing: 2 })).toEqual([]);
      expect(assessBackfill({ dated: 3, missing: 2 })).toEqual([]);
    });

    // A shell without the storage settings reads the local disk: everything
    // comes out "missing", and that must not look like a success.
    it('refuses a run that could read nothing', () => {
      expect(assessBackfill({ sized: 0, missing: 40 })).toHaveLength(1);
    });

    // A rerun after a good run only meets the files that really are gone.
    it('accepts it once the storage was checked against a known file', () => {
      expect(assessBackfill({ missing: 4, storageVerified: 1 })).toEqual([]);
    });

    // A JPEG whose size could not be found is still an image: shown apart,
    // and no rerun will find it either.
    it('reports an unmeasured JPEG apart, without failing the run', () => {
      const totals = { sized: 3, [READ_STATUS.UNMEASURED]: 2 };

      expect(assessBackfill(totals)).toEqual([]);
      expect(backfill.summarize(totals, { dryRun: false })).toContainEqual([
        'Size not found',
        2,
      ]);
    });

    it('asks for a rerun after a timeout or a storage error', () => {
      const failures = assessBackfill({ sized: 9, timeout: 1, error: 1 });
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

  it('selects the galleries holding a file without dimensions or date', () => {
    expect(backfill.query.files.$elemMatch.$or).toEqual([
      { width: { $in: [null, 0] } },
      { height: { $in: [null, 0] } },
      { uploadedAt: null },
    ]);
  });

  it('shows what it filled, field by field', () => {
    const rows = backfill.summarize(
      { sized: 2, dated: 3, undatable: 1 },
      { dryRun: true }
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        ['Dimensions to fill', 2],
        ['Dates to fill', 3],
        ['Date not found', 1],
      ])
    );
  });
});
