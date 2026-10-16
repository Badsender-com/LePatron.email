'use strict';

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../packages/server/common/models.common.js', () => ({
  Galleries: { collection: {} },
}));

const mongoose = require('mongoose');
const config = require('../../packages/server/node.config.js');
const { Galleries } = require('../../packages/server/common/models.common.js');
const {
  runGalleryScript,
  parseArgs,
  databaseHosts,
  redact,
  eachWithConcurrency,
  DEFAULT_CONCURRENCY,
} = require('../../scripts/gallery/run-gallery-script.js');

const URI_WITH_CREDENTIALS =
  'mongodb://operator:s3cr3t-password@db.example.test:27017/app';

// A collection serving `galleries` page by page, like `find().sort().limit()`.
function fakeCollection(galleries) {
  return {
    countDocuments: jest.fn().mockResolvedValue(galleries.length),
    find: jest.fn((filter) => {
      const after = filter.$and ? filter.$and[1]._id.$gt : null;
      let limit = Infinity;
      const chain = {
        sort: () => chain,
        limit: (n) => {
          limit = n;
          return chain;
        },
        toArray: async () =>
          galleries
            .filter((g) => after === null || g._id > after)
            .slice(0, limit),
      };
      return chain;
    }),
  };
}

function script(overrides) {
  return {
    title: 'Test script',
    query: { files: { $elemMatch: { uploadedAt: null } } },
    projection: { files: 1 },
    processGallery: jest.fn().mockResolvedValue({ done: 1 }),
    describeCounts: ({ done }) => `${done} done`,
    summarize: (totals) => [`Done: ${totals.done || 0}`],
    ...overrides,
  };
}

function output() {
  return [...console.log.mock.calls, ...console.error.mock.calls]
    .map((args) => args.join(' '))
    .join('\n');
}

const galleries = (count) =>
  Array.from({ length: count }, (_, i) => ({
    _id: i + 1,
    creationOrWireframeId: `creation-${i + 1}`,
    files: [],
  }));

describe('run-gallery-script', () => {
  const originalDatabase = config.database;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mongoose.connect.mockClear();
    mongoose.disconnect.mockClear();
    config.database = URI_WITH_CREDENTIALS;
  });

  afterEach(() => {
    config.database = originalDatabase;
    jest.restoreAllMocks();
  });

  describe('parseArgs', () => {
    it('reads the dry-run flag and defaults the concurrency', () => {
      expect(parseArgs(['node', 'x', '--dry-run'])).toEqual({
        dryRun: true,
        concurrency: DEFAULT_CONCURRENCY,
      });
    });

    it('takes a concurrency, and refuses one out of range', () => {
      expect(parseArgs(['--concurrency=8']).concurrency).toBe(8);
      expect(() => parseArgs(['--concurrency=0'])).toThrow();
      expect(() => parseArgs(['--concurrency=many'])).toThrow();
    });
  });

  // The connection string carries the database password.
  describe('never prints the credentials', () => {
    it('names the hosts only', () => {
      expect(databaseHosts(URI_WITH_CREDENTIALS)).toBe('db.example.test:27017');
      expect(
        databaseHosts('mongodb://u:p@h1:27017,h2:27017/app?replicaSet=rs0')
      ).toBe('h1:27017,h2:27017');
      expect(databaseHosts('mongodb+srv://u:p@cluster.example.test/app')).toBe(
        'cluster.example.test'
      );
    });

    it('scrubs an error message that quotes the URI back', () => {
      const message = redact(`cannot reach ${URI_WITH_CREDENTIALS}`);
      expect(message).not.toContain('s3cr3t-password');
      expect(redact('at mongodb://a:b@host/db')).not.toContain('a:b');
    });

    it('keeps the whole run output free of them', async () => {
      Galleries.collection = fakeCollection(galleries(2));
      const failing = script({
        processGallery: jest
          .fn()
          .mockRejectedValue(new Error(`write to ${URI_WITH_CREDENTIALS}`)),
      });

      await runGalleryScript(failing, { argv: [] });

      expect(output()).toContain('db.example.test:27017');
      expect(output()).not.toContain('s3cr3t-password');
    });
  });

  it('pages through the galleries by _id, and processes each once', async () => {
    Galleries.collection = fakeCollection(galleries(250));
    const counting = script();

    const code = await runGalleryScript(counting, { argv: [] });

    expect(code).toBe(0);
    expect(counting.processGallery).toHaveBeenCalledTimes(250);
    // 100 + 100 + 50, then the empty page that ends the run
    expect(Galleries.collection.find).toHaveBeenCalledTimes(4);
    expect(output()).toContain('Done: 250');
  });

  it('passes the dry-run flag and the raw collection to the script', async () => {
    Galleries.collection = fakeCollection(galleries(1));
    const dry = script();

    await runGalleryScript(dry, { argv: ['--dry-run'] });

    expect(dry.processGallery).toHaveBeenCalledWith(
      expect.objectContaining({ creationOrWireframeId: 'creation-1' }),
      expect.objectContaining({
        dryRun: true,
        collection: Galleries.collection,
      })
    );
    expect(output()).toContain('[DRY-RUN] Nothing was written.');
  });

  it('carries on past a failing gallery, lists it, and exits 1', async () => {
    Galleries.collection = fakeCollection(galleries(3));
    const flaky = script({
      processGallery: jest.fn(async (gallery) => {
        if (gallery._id === 2) throw new Error('boom');
        return { done: 1 };
      }),
    });

    const code = await runGalleryScript(flaky, { argv: [] });

    expect(code).toBe(1);
    expect(flaky.processGallery).toHaveBeenCalledTimes(3);
    expect(output()).toMatch(/1 gallery\(ies\) failed[\s\S]*creation-2/);
    expect(output()).toContain('Done: 2');
  });

  it('prints a summary and disconnects when the database fails mid-run', async () => {
    Galleries.collection = fakeCollection(galleries(1));
    Galleries.collection.countDocuments.mockRejectedValue(
      new Error('server selection timed out')
    );

    const code = await runGalleryScript(script(), { argv: [] });

    expect(code).toBe(1);
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(output()).toContain('Stopped by: server selection timed out');
  });

  it('fails the run when the script says the result cannot be trusted', async () => {
    Galleries.collection = fakeCollection(galleries(1));
    const doubtful = script({ assess: () => ['nothing could be read'] });

    const code = await runGalleryScript(doubtful, { argv: [] });

    expect(code).toBe(1);
    expect(output()).toContain('nothing could be read');
  });

  it('processes nothing when the preflight check refuses', async () => {
    Galleries.collection = fakeCollection(galleries(2));
    const checked = script({
      preflight: jest.fn().mockRejectedValue(new Error('wrong storage')),
    });

    const code = await runGalleryScript(checked, { argv: [] });

    expect(code).toBe(1);
    expect(checked.processGallery).not.toHaveBeenCalled();
    expect(output()).toContain('wrong storage');
  });

  describe('eachWithConcurrency', () => {
    it('never runs more workers at once than asked', async () => {
      let running = 0;
      let peak = 0;
      const worker = async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setImmediate(resolve));
        running -= 1;
      };

      await eachWithConcurrency(
        Array.from({ length: 20 }),
        3,
        worker,
        () => false
      );

      expect(peak).toBe(3);
    });

    it('takes no new item once asked to stop', async () => {
      const seen = [];
      let stop = false;
      await eachWithConcurrency(
        [1, 2, 3, 4],
        1,
        async (item) => {
          seen.push(item);
          if (item === 2) stop = true;
        },
        () => stop
      );

      expect(seen).toEqual([1, 2]);
    });
  });
});
