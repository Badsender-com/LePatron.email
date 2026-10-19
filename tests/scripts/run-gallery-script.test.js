'use strict';

jest.mock('mongoose', () => {
  const galleries = { collection: {} };
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connection: { name: 'app' },
    models: {},
    model: jest.fn(() => galleries),
  };
});
jest.mock('../../packages/server/image/gallery.schema.js', () => ({}));

const mongoose = require('mongoose');
const config = require('../../packages/server/node.config.js');
const {
  runGalleryScript,
  runFromCommandLine,
  parseArgs,
  databaseHosts,
  redact,
  eachWithConcurrency,
  DEFAULT_CONCURRENCY,
} = require('../../scripts/gallery/run-gallery-script.js');

const Galleries = mongoose.model();

// A real run names the database it writes to; the mocked connection is "app".
const CONFIRMED = ['--database=app'];

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
    summarize: (totals) => [['Done', totals.done]],
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
        database: null,
      });
    });

    it('takes a concurrency, and refuses one out of range', () => {
      expect(parseArgs(['--concurrency=8', ...CONFIRMED]).concurrency).toBe(8);
      expect(() => parseArgs(['--concurrency=0', ...CONFIRMED])).toThrow();
      expect(() => parseArgs(['--concurrency=many', ...CONFIRMED])).toThrow();
    });

    // A run that writes must say where, before anything connects.
    it('refuses a real run that does not name its database', () => {
      expect(() => parseArgs([])).toThrow(/--database=<name>/);
      expect(() => parseArgs(['--database='])).toThrow(/--database=<name>/);
      expect(parseArgs(CONFIRMED).database).toBe('app');
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

      await runGalleryScript(failing, { argv: CONFIRMED });

      expect(output()).toContain('db.example.test:27017');
      expect(output()).not.toContain('s3cr3t-password');
    });

    // What fails before the run starts reaches the entry point's own line.
    it('keeps them out of the fatal error line too', async () => {
      const { setup } = config;
      config.setup = Promise.reject(
        new Error(`cannot open ${URI_WITH_CREDENTIALS}`)
      );
      const exitCode = process.exitCode;

      try {
        await runFromCommandLine(script(), { argv: CONFIRMED });
        expect(process.exitCode).toBe(1);
      } finally {
        config.setup = setup;
        process.exitCode = exitCode;
      }

      expect(output()).toContain('Fatal error: cannot open <database URI>');
      expect(output()).not.toContain('s3cr3t-password');
    });
  });

  describe('names the database, and writes only to the one confirmed', () => {
    it('prints the name of the database it is connected to', async () => {
      Galleries.collection = fakeCollection(galleries(1));

      await runGalleryScript(script(), { argv: ['--dry-run'] });

      expect(output()).toContain('Database: "app" on db.example.test:27017');
    });

    // The override of the database did not apply: the run reached another one.
    it('refuses to write to a database other than the one confirmed', async () => {
      Galleries.collection = fakeCollection(galleries(2));
      const writing = script({ preflight: jest.fn() });

      const code = await runGalleryScript(writing, {
        argv: ['--database=app-copy'],
      });

      expect(code).toBe(1);
      expect(writing.preflight).not.toHaveBeenCalled();
      expect(writing.processGallery).not.toHaveBeenCalled();
      expect(output()).toMatch(/--database=app-copy.*"app"/);
    });

    it('runs a dry-run without confirmation', async () => {
      Galleries.collection = fakeCollection(galleries(1));
      const dry = script();

      const code = await runGalleryScript(dry, { argv: ['--dry-run'] });

      expect(code).toBe(0);
      expect(dry.processGallery).toHaveBeenCalledTimes(1);
    });
  });

  // A dry-run writes nothing, indexes included: on a copy restored without
  // them, Mongoose would otherwise build every index of the model.
  it('connects without building indexes', async () => {
    Galleries.collection = fakeCollection(galleries(1));

    await runGalleryScript(script(), { argv: ['--dry-run'] });

    expect(mongoose.connect).toHaveBeenCalledWith(
      config.database,
      expect.objectContaining({ autoIndex: false })
    );
  });

  it('pages through the galleries by _id, and processes each once', async () => {
    Galleries.collection = fakeCollection(galleries(250));
    const counting = script();

    const code = await runGalleryScript(counting, { argv: CONFIRMED });

    expect(code).toBe(0);
    expect(counting.processGallery).toHaveBeenCalledTimes(250);
    // 100 + 100 + 50, then the empty page that ends the run
    expect(Galleries.collection.find).toHaveBeenCalledTimes(4);
    expect(output()).toMatch(/Done +: 250/);
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

    const code = await runGalleryScript(flaky, { argv: CONFIRMED });

    expect(code).toBe(1);
    expect(flaky.processGallery).toHaveBeenCalledTimes(3);
    expect(output()).toMatch(/1 gallery\(ies\) failed[\s\S]*creation-2/);
    expect(output()).toMatch(/Done +: 2\b/);
  });

  it('prints a summary and disconnects when the database fails mid-run', async () => {
    Galleries.collection = fakeCollection(galleries(1));
    Galleries.collection.countDocuments.mockRejectedValue(
      new Error('server selection timed out')
    );

    const code = await runGalleryScript(script(), { argv: CONFIRMED });

    expect(code).toBe(1);
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(output()).toContain('Stopped by: server selection timed out');
  });

  it('fails the run when the script says the result cannot be trusted', async () => {
    Galleries.collection = fakeCollection(galleries(1));
    const doubtful = script({ assess: () => ['nothing could be read'] });

    const code = await runGalleryScript(doubtful, { argv: CONFIRMED });

    expect(code).toBe(1);
    expect(output()).toContain('nothing could be read');
  });

  it('processes nothing when the preflight check refuses', async () => {
    Galleries.collection = fakeCollection(galleries(2));
    const checked = script({
      preflight: jest.fn().mockRejectedValue(new Error('wrong storage')),
    });

    const code = await runGalleryScript(checked, { argv: CONFIRMED });

    expect(code).toBe(1);
    expect(checked.processGallery).not.toHaveBeenCalled();
    expect(output()).toContain('wrong storage');
  });

  describe('stopping', () => {
    it('lets the script see an interrupt, and stops taking galleries', async () => {
      Galleries.collection = fakeCollection(galleries(3));
      const seen = [];
      const interrupted = script({
        processGallery: jest.fn(async (gallery, { isStopping }) => {
          if (gallery._id === 1) process.emit('SIGINT');
          seen.push(isStopping());
          return { done: 1 };
        }),
      });

      const code = await runGalleryScript(interrupted, {
        argv: [...CONFIRMED, '--concurrency=1'],
      });

      expect(code).toBe(1);
      expect(seen).toEqual([true]);
      expect(output()).toContain('Interrupted: rerun to resume.');
    });

    // The galleries in progress can take long on a storage that stalls.
    it('exits at once on a second interrupt', async () => {
      Galleries.collection = fakeCollection(galleries(1));
      const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const twice = script({
        processGallery: jest.fn(async () => {
          process.emit('SIGINT');
          process.emit('SIGINT');
          return { done: 1 };
        }),
      });

      await runGalleryScript(twice, { argv: CONFIRMED });

      expect(exit).toHaveBeenCalledWith(130);
      expect(exit).toHaveBeenCalledTimes(1);
    });

    it('lets the script stop the run, and says why', async () => {
      Galleries.collection = fakeCollection(galleries(3));
      const breaking = script({
        processGallery: jest.fn(async (gallery, { stop }) => {
          stop('the storage looks down');
          return { done: 1 };
        }),
      });

      const code = await runGalleryScript(breaking, {
        argv: [...CONFIRMED, '--concurrency=1'],
      });

      expect(code).toBe(1);
      expect(breaking.processGallery).toHaveBeenCalledTimes(1);
      expect(output()).toContain('Stopped: the storage looks down');
    });

    it('keeps one state for the whole run', async () => {
      Galleries.collection = fakeCollection(galleries(2));
      const states = [];
      const stateful = script({
        processGallery: jest.fn(async (gallery, { state }) => {
          states.push(state);
          return { done: 1 };
        }),
      });

      await runGalleryScript(stateful, { argv: CONFIRMED });

      expect(states[0]).toBe(states[1]);
    });
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
