/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The publication guard as a task of the server (ADR 0019): starting it
// answers at once, the replay goes on after, and the person who started it
// reads it again until it is done or failed. No request waits for the AI.

const { createMcpStore } = require('../../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const createError = require('http-errors');
const guardRuns = require('../../../../packages/server/ai-skill/services/guard-runs.js');

const ALICE = { id: '507f1f77bcf86cd799439011' };
const BOB = { id: '507f1f77bcf86cd799439012' };
const TARGET = {
  kind: 'expertise',
  id: 'redaction.subject-line',
  version: { major: 3, minor: 0 },
};
const PLAN = {
  usedBy: [{ featureType: 'subject_generation', description: 'Subjects' }],
  calls: 4,
  maxCalls: 60,
  notReplayed: 0,
  missing: [],
};
const GUARD = {
  cases: [{ skillId: 'redaction.subject-ideas', name: 'A sale' }],
  missing: [],
  notReplayed: 0,
  key: 'the-key.signed',
};

// A replay the test lets finish when it chooses.
function heldReplay() {
  let finish;
  let fail;
  const run = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        finish = () => resolve(GUARD);
        fail = (err) => reject(err);
      })
  );
  return { run, finish: () => finish(), fail: (err) => fail(err) };
}

beforeEach(() => store.seed({}));
afterEach(() => guardRuns.guardRunsSettled());

describe('the publication guard, as a task of the server', () => {
  it('answers at once, running, with what it will replay', async () => {
    const replay = heldReplay();

    const started = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );

    expect(started).toMatchObject({
      id: expect.any(String),
      status: 'running',
      targets: [{ kind: 'expertise', id: TARGET.id, version: '3.0' }],
      usedBy: PLAN.usedBy,
      calls: 4,
      maxCalls: 60,
    });
    expect(started.key).toBeUndefined();
    expect(started.cases).toBeUndefined();
    replay.finish();
  });

  it('is read done, with the cases and the key, once the replay ends', async () => {
    const replay = heldReplay();
    const { id } = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );

    replay.finish();
    await guardRuns.guardRunsSettled();

    expect(await guardRuns.readGuard(id, ALICE)).toMatchObject({
      id,
      status: 'done',
      cases: GUARD.cases,
      key: GUARD.key,
    });
  });

  it('answers done at once when there is no AI call to make', async () => {
    const started = await guardRuns.startGuard(
      {
        targets: [TARGET],
        plan: { usedBy: [], calls: 0, missing: [] },
        run: async () => ({ cases: [], missing: [], key: 'free.key' }),
      },
      ALICE
    );

    expect(started).toMatchObject({ status: 'done', key: 'free.key' });
  });

  it('is read failed, with the code of a refusal, when the replay fails', async () => {
    const replay = heldReplay();
    const { id } = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );

    replay.fail(createError(409, 'PLATFORM_GROUP_NOT_FOUND'));
    await guardRuns.guardRunsSettled();

    const read = await guardRuns.readGuard(id, ALICE);
    expect(read).toMatchObject({
      status: 'failed',
      code: 'PLATFORM_GROUP_NOT_FOUND',
    });
    expect(read.key).toBeUndefined();
  });

  it('says nothing of an unexpected failure but that it failed', async () => {
    const replay = heldReplay();
    const { id } = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );

    replay.fail(new Error('connection reset by the provider'));
    await guardRuns.guardRunsSettled();

    expect(await guardRuns.readGuard(id, ALICE)).toMatchObject({
      status: 'failed',
      code: 'SKILL_PUBLICATION_GUARD_FAILED',
    });
  });

  it('is read by the person who started it only', async () => {
    const replay = heldReplay();
    const { id } = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );
    replay.finish();
    await guardRuns.guardRunsSettled();

    await expect(guardRuns.readGuard(id, BOB)).rejects.toMatchObject({
      status: 404,
      message: 'SKILL_PUBLICATION_GUARD_NOT_FOUND',
    });
    await expect(
      guardRuns.readGuard({ $ne: null }, ALICE)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('says a run still going past its time was interrupted', async () => {
    const replay = heldReplay();
    const { id } = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: replay.run },
      ALICE
    );
    // Its process gone, its time is over.
    store.update('guardRuns', id, { expiresAt: new Date(Date.now() - 1000) });

    expect(await guardRuns.readGuard(id, ALICE)).toMatchObject({
      status: 'failed',
      code: 'SKILL_PUBLICATION_GUARD_INTERRUPTED',
    });
    replay.finish();
    await guardRuns.guardRunsSettled();
    // A replay that ends after is not recorded over it.
    expect((await guardRuns.readGuard(id, ALICE)).status).toBe('failed');
  });

  it('refuses a person a run more than the runs they may have going', async () => {
    const replays = Array.from({ length: guardRuns.MAX_RUNNING }, heldReplay);
    // eslint-disable-next-line no-restricted-syntax
    for (const replay of replays) {
      // eslint-disable-next-line no-await-in-loop
      await guardRuns.startGuard(
        { targets: [TARGET], plan: PLAN, run: replay.run },
        ALICE
      );
    }
    const extra = heldReplay();

    await expect(
      guardRuns.startGuard(
        { targets: [TARGET], plan: PLAN, run: extra.run },
        ALICE
      )
    ).rejects.toMatchObject({
      status: 429,
      message: 'SKILL_PUBLICATION_GUARDS_BUSY',
    });
    expect(extra.run).not.toHaveBeenCalled();
    // Someone else's runs are their own.
    const other = await guardRuns.startGuard(
      { targets: [TARGET], plan: PLAN, run: extra.run },
      BOB
    );
    expect(other.status).toBe('running');
    replays.forEach((replay) => replay.finish());
    extra.finish();
  });
});
