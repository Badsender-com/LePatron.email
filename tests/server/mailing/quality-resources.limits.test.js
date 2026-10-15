'use strict';

// The server fetches addresses any logged-in user typed: the bounds matter as
// much as the results. Probes per worker, one run at a time per user with a
// bounded wait, a few runs per window, and a run cut short once its caller
// is gone.

const { deps, run, resetQuality } = require('./quality-resources.harness.js');
const {
  checkResources,
  RUNS_PER_WINDOW,
} = require('../../../packages/server/mailing/quality-resources.service.js');
const {
  MAX_LINK_PROBES,
} = require('../../../packages/server/mailing/quality-links.service.js');
const {
  QUEUE_WAIT_MS,
} = require('../../../packages/server/mailing/quality-limits.js');

beforeEach(resetQuality);

describe('link probes for the worker', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('are capped whoever asks, and a run out of time while waiting judges nothing', async () => {
    const pending = [];
    const d = deps({
      probe: jest.fn(
        () =>
          new Promise((resolve) => {
            pending.push(() => resolve({ status: 200 }));
          })
      ),
    });
    // Enough users, each with a run's worth of parallel probes, to fill the
    // worker's slots; the next run waits for one.
    const perRun = 4;
    const runs = [];
    for (let u = 0; u < MAX_LINK_PROBES / perRun; u += 1) {
      const links = Array.from(
        { length: perRun },
        (_, i) => `https://site${u}-${i}.test/`
      );
      runs.push(run({ links }, d, { userKey: `u${u}` }));
    }
    const late = run({ links: ['https://late.test/'] }, d, { userKey: 'late' });
    await flush();
    expect(d.probe).toHaveBeenCalledTimes(MAX_LINK_PROBES);

    // Its deadline passes while it waits: the slot it gets is not used.
    const now = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => now() + 60 * 1000);
    pending.forEach((release) => release());
    await Promise.all(runs);
    const { links } = await late;
    Date.now.mockRestore();

    expect(links['https://late.test/']).toEqual({ state: 'unverifiable' });
    expect(d.probe).toHaveBeenCalledTimes(MAX_LINK_PROBES);
  });
});

describe('throttle', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  // Under fake timers, setImmediate is faked too.
  const realSetImmediate = jest.requireActual('timers').setImmediate;
  const flushReal = () => new Promise((resolve) => realSetImmediate(resolve));

  it('runs one check at a time per user, the next one waiting its turn, a third refused', async () => {
    const releases = [];
    const d = deps({
      probe: jest.fn(
        () =>
          new Promise((resolve) => {
            releases.push(() => resolve({ status: 200 }));
          })
      ),
    });
    const first = run({ links: ['https://a.test'] }, d);
    // A second tab, or an export during a run: it waits for the first.
    let secondDone = false;
    const second = run({ links: ['https://b.test'] }, d).then((result) => {
      secondDone = true;
      return result;
    });
    await flush();
    expect(d.probe).toHaveBeenCalledTimes(1);
    expect(secondDone).toBe(false);
    // Only one can wait: a script firing more is refused.
    await expect(run({ links: ['https://c.test'] }, d)).rejects.toMatchObject({
      status: 429,
      message: 'QUALITY_CHECK_RUNNING',
    });
    // Another user is not held up.
    await expect(
      run({ links: [] }, d, { userKey: 'u2' })
    ).resolves.toBeDefined();

    releases.shift()();
    await first;
    await flush();
    expect(d.probe).toHaveBeenCalledTimes(2);
    releases.shift()();
    await expect(second).resolves.toMatchObject({
      links: { 'https://b.test': { state: 'ok' } },
    });
    await expect(run({ links: ['https://a.test'] }, d)).resolves.toBeDefined();
  });

  it('runs the waiting check even when the first one failed', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    // An address the validation would have refused makes the run itself fail.
    const failing = checkResources(
      { links: [], images: [{ url: 'not a url' }] },
      { userKey: 'u1', cacheScope: 'c1', ownHosts: [] },
      d
    );
    const second = run({ links: ['https://b.test'] }, d);
    await expect(failing).rejects.toBeDefined();
    await expect(second).resolves.toMatchObject({
      links: { 'https://b.test': { state: 'ok' } },
    });
  });

  it('fetches nothing more for a run whose caller is gone', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    const caller = new AbortController();
    caller.abort();
    const { links, images } = await run(
      {
        links: ['https://a.test'],
        images: ['https://cdn.test/a.png'],
      },
      d,
      { signal: caller.signal }
    );
    expect(links['https://a.test']).toEqual({ state: 'unverifiable' });
    expect(images['https://cdn.test/a.png']).toEqual({ state: 'unverifiable' });
    expect(d.probe).not.toHaveBeenCalled();
  });

  it('stops fetching for a run cancelled while it waits its turn', async () => {
    let release;
    const d = deps({
      probe: jest.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: 200 });
          })
      ),
    });
    const first = run({ links: ['https://a.test'] }, d);
    const caller = new AbortController();
    const second = run({ links: ['https://b.test'] }, d, {
      signal: caller.signal,
    });
    await flush();
    caller.abort();
    release();
    await first;
    const { links } = await second;
    expect(links['https://b.test']).toEqual({ state: 'unverifiable' });
    expect(d.probe).toHaveBeenCalledTimes(1);
  });

  // The editor gives up after its own timeout: a run that waited its turn
  // and then took a whole deadline of its own would answer nobody.
  it('refuses as running a check that waited too long for its turn', async () => {
    jest.useFakeTimers('modern');
    try {
      let release;
      const d = deps({
        probe: jest.fn(
          () =>
            new Promise((resolve) => {
              release = () => resolve({ status: 200 });
            })
        ),
      });
      const first = run({ links: ['https://a.test'] }, d);
      const second = run({ links: ['https://b.test'] }, d);
      await flushReal();
      jest.advanceTimersByTime(QUEUE_WAIT_MS);
      await expect(second).rejects.toMatchObject({
        status: 429,
        message: 'QUALITY_CHECK_RUNNING',
      });
      // The first run still holds the turn: the next one waits for it.
      const third = run({ links: ['https://c.test'] }, d);
      await flushReal();
      expect(d.probe).toHaveBeenCalledTimes(1);
      release();
      await first;
      await flushReal();
      release();
      await expect(third).resolves.toMatchObject({
        links: { 'https://c.test': { state: 'ok' } },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts the deadline of a check from its arrival, waiting included', async () => {
    let now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      let release;
      const d = deps({
        probe: jest.fn(
          () =>
            new Promise((resolve) => {
              release = () => resolve({ status: 200 });
            })
        ),
      });
      const first = run({ links: ['https://a.test'] }, d);
      const second = run({ links: ['https://b.test'] }, d);
      await flush();
      // Its deadline passes before its turn comes: it fetches nothing.
      now += 20001;
      release();
      await first;
      const { links } = await second;
      expect(links['https://b.test']).toEqual({ state: 'unverifiable' });
      expect(d.probe).toHaveBeenCalledTimes(1);
    } finally {
      Date.now.mockRestore();
    }
  });

  it('allows a few runs per window, then refuses', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    for (let i = 0; i < RUNS_PER_WINDOW; i += 1) {
      await run({ links: [] }, d);
    }
    await expect(run({ links: [] }, d)).rejects.toMatchObject({
      status: 429,
      message: 'QUALITY_CHECKS_TOO_FREQUENT',
    });
  });
});
