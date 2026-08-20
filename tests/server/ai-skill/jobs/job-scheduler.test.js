'use strict';

const JobScheduler = require('../../../../packages/server/ai-skill/jobs/job-scheduler');
const {
  JOB_NAME,
} = require('../../../../packages/server/ai-skill/jobs/purge-skill-invocations.job');

/**
 * Minimal stand-in for the Agenda class. Records what the scheduler asks of it
 * so the wiring (define → start → every) can be asserted without a database.
 */
function makeAgendaClass(calls) {
  return class FakeAgenda {
    constructor(options) {
      calls.constructedWith = options;
      this.defined = [];
      this.scheduled = [];
      this.started = false;
      this.stopped = false;
    }

    define(name, handler) {
      this.defined.push({ name, handler });
    }

    async every(schedule, name) {
      this.scheduled.push({ schedule, name });
    }

    async start() {
      this.started = true;
    }

    async stop() {
      this.stopped = true;
    }
  };
}

describe('JobScheduler', () => {
  it('does nothing when no mongoUrl is provided', async () => {
    const scheduler = new JobScheduler({});
    expect(await scheduler.start()).toBeNull();
    expect(scheduler.agenda).toBeNull();
  });

  it('defines, starts and schedules the purge job', async () => {
    const calls = {};
    const scheduler = new JobScheduler({
      mongoUrl: 'mongodb://127.0.0.1:27017/lepatron-test',
      agendaFactory: makeAgendaClass(calls),
    });

    const agenda = await scheduler.start();

    expect(calls.constructedWith).toEqual({
      db: {
        address: 'mongodb://127.0.0.1:27017/lepatron-test',
        collection: 'aiSkillJobs',
      },
      processEvery: '1 minute',
    });
    expect(agenda.started).toBe(true);
    expect(agenda.defined.map((d) => d.name)).toEqual([JOB_NAME]);
    expect(agenda.scheduled).toEqual([
      { schedule: expect.any(String), name: JOB_NAME },
    ]);
    expect(scheduler.registered.map((j) => j.name)).toEqual([JOB_NAME]);
  });

  it('is idempotent: a second start() reuses the same agenda instance', async () => {
    const scheduler = new JobScheduler({
      mongoUrl: 'mongodb://127.0.0.1:27017/lepatron-test',
      agendaFactory: makeAgendaClass({}),
    });
    const first = await scheduler.start();
    expect(await scheduler.start()).toBe(first);
    expect(first.defined).toHaveLength(1);
  });

  it('stop() stops agenda and clears the instance', async () => {
    const scheduler = new JobScheduler({
      mongoUrl: 'mongodb://127.0.0.1:27017/lepatron-test',
      agendaFactory: makeAgendaClass({}),
    });
    const agenda = await scheduler.start();
    await scheduler.stop();
    expect(agenda.stopped).toBe(true);
    expect(scheduler.agenda).toBeNull();
    await expect(scheduler.stop()).resolves.toBeUndefined();
  });

  /**
   * Regression guard for the `agenda@6` incompatibility: v6 is an ESM-only
   * rewrite whose backends are externalised, so `require()` returns a
   * namespace instead of the class and the `db` option no longer exists —
   * `new Agenda({ db })` throws and the scheduler never starts, silently,
   * behind the .catch in index.js. This asserts the installed version keeps
   * the CommonJS, `db`-option API the scheduler is written against.
   *
   * Deliberately does not instantiate Agenda: the constructor connects to
   * Mongo as a side effect, which would leave an open handle in the suite.
   */
  describe('installed agenda package', () => {
    it('is CommonJS and exports the class as module.exports', () => {
      // eslint-disable-next-line global-require
      expect(require('agenda/package.json').type).not.toBe('module');
      // eslint-disable-next-line global-require
      expect(typeof require('agenda')).toBe('function');
    });

    it('exposes the API job-scheduler.js calls', () => {
      // eslint-disable-next-line global-require
      const Agenda = require('agenda');
      // `database` is the handler behind the `db: { address, collection }`
      // constructor option, dropped in v6.
      for (const method of ['database', 'define', 'every', 'start', 'stop']) {
        expect(typeof Agenda.prototype[method]).toBe('function');
      }
    });
  });
});
