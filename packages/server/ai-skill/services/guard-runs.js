'use strict';

/**
 * The publication guard as a task of the server (ADR 0019): starting it
 * answers at once, with what it will replay, and the replay goes on after the
 * request has answered, for the back office and for an assistant alike. The
 * person who started it reads it again until it is done, with the cases
 * before and after and the key its publication requires (guard-key.js), or
 * failed. No request waits for the AI.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { PublicationGuardRuns } = require('../../common/models.common.js');
const { isObjectIdString } = require('../../utils/model.js');
const { KEY_LIFETIME_MS } = require('./guard-key.js');

// A replay makes 60 AI calls at most, three at a time, each cut after 30
// seconds: ten minutes at worst. A run still going after twice that has lost
// its process.
const RUN_MS = 20 * 60 * 1000;
// Kept as long as its key may publish, then removed by the database.
const KEEP_MS = RUN_MS + KEY_LIFETIME_MS;
// The runs one person may have going at once.
const MAX_RUNNING = 3;

const RUNNING = 'running';

// The runs going on in this process, for the tests to wait for.
const pending = new Set();

const label = ({ major, minor }) => `${major}.${minor}`;

const notFound = () =>
  createError(404, ERROR_CODES.SKILL_PUBLICATION_GUARD_NOT_FOUND);

// A refusal of the services keeps its code; anything else is a failure.
const codeOf = (err) =>
  err && err.expose === true && ERROR_CODES[err.message] === err.message
    ? err.message
    : ERROR_CODES.SKILL_PUBLICATION_GUARD_FAILED;

async function refuseWhenBusy(by, now) {
  const running = await PublicationGuardRuns.countDocuments({
    by,
    status: RUNNING,
    expiresAt: { $gt: now },
  });
  if (running >= MAX_RUNNING) {
    throw createError(429, ERROR_CODES.SKILL_PUBLICATION_GUARDS_BUSY, {
      max: MAX_RUNNING,
    });
  }
}

// Runs the replay and records how it ended, never thrown: nobody waits for it.
async function execute(id, run) {
  let outcome;
  try {
    const guard = await run();
    outcome = {
      status: 'done',
      cases: guard.cases,
      missing: guard.missing || [],
      notReplayed: guard.notReplayed || 0,
      key: guard.key,
    };
  } catch (err) {
    logger.error(`[ai-skill] the publication guard ${id} failed`, err);
    outcome = { status: 'failed', code: codeOf(err) };
  }
  await PublicationGuardRuns.updateOne(
    { _id: id, status: RUNNING },
    { $set: { ...outcome, finishedAt: new Date() } }
  );
}

function inBackground(id, run) {
  const task = execute(id, run)
    .catch((err) =>
      logger.error(
        `[ai-skill] the publication guard ${id} was not recorded`,
        err
      )
    )
    .finally(() => pending.delete(task));
  pending.add(task);
  return task;
}

/** Resolves once every run started in this process has ended. */
async function guardRunsSettled() {
  while (pending.size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all([...pending]);
  }
}

// What the person reads of a run: its key once done, never to anyone else.
function viewOf(run) {
  const { status } = run;
  return {
    id: String(run._id),
    status,
    targets: (run.targets || []).map(({ kind, id, version }) => ({
      kind,
      id,
      version,
    })),
    usedBy: run.usedBy || [],
    calls: run.calls || 0,
    maxCalls: run.maxCalls || 0,
    notReplayed: run.notReplayed || 0,
    missing: run.missing || [],
    ...(status === 'done' && { cases: run.cases || [], key: run.key }),
    ...(status === 'failed' && { code: run.code }),
  };
}

/**
 * A run of the guard, as the person who started it reads it. One still
 * running past its time was interrupted, and says so.
 *
 * @param {string} id
 * @param {{ id: string }} user
 * @returns {Promise<{ id, status: 'running'|'done'|'failed', targets,
 *   usedBy, calls, maxCalls, notReplayed, missing, cases?, key?, code? }>}
 * @throws {HttpError} 404 `SKILL_PUBLICATION_GUARD_NOT_FOUND`, for a run of
 *   someone else too
 */
async function readGuard(id, user) {
  if (!isObjectIdString(id)) throw notFound();
  const run = await PublicationGuardRuns.findOne({
    _id: id,
    by: String(user && user.id),
  }).lean();
  if (!run) throw notFound();
  const now = new Date();
  if (run.status === RUNNING && new Date(run.expiresAt) < now) {
    const interrupted = {
      status: 'failed',
      code: ERROR_CODES.SKILL_PUBLICATION_GUARD_INTERRUPTED,
      finishedAt: now,
    };
    await PublicationGuardRuns.updateOne(
      { _id: id, status: RUNNING },
      { $set: interrupted }
    );
    return viewOf({ ...run, ...interrupted });
  }
  return viewOf(run);
}

/**
 * Starts a run of the guard and answers at once, running, with what it will
 * replay; a run with no AI call to make is answered done.
 *
 * @param {Object} params
 * @param {Array<{ kind, id, version: { major, minor } }>} params.targets
 * @param {{ usedBy, calls, maxCalls?, notReplayed?, missing }} params.plan
 *   what it will replay, as planned without calling the AI
 * @param {() => Promise<{ cases, missing, notReplayed?, key }>} params.run
 *   the replay itself
 * @param {{ id: string }} user who starts it
 * @returns {Promise<Object>} the run, as readGuard answers it
 * @throws {HttpError} 429 `SKILL_PUBLICATION_GUARDS_BUSY`
 */
async function startGuard({ targets, plan, run }, user) {
  const now = new Date();
  const by = String(user && user.id);
  await refuseWhenBusy(by, now);
  const record = await PublicationGuardRuns.create({
    status: RUNNING,
    by,
    targets: targets.map(({ kind, id, version }) => ({
      kind,
      id,
      version: label(version),
    })),
    usedBy: plan.usedBy || [],
    calls: plan.calls || 0,
    maxCalls: plan.maxCalls || 0,
    notReplayed: plan.notReplayed || 0,
    missing: plan.missing || [],
    startedAt: now,
    expiresAt: new Date(now.getTime() + RUN_MS),
    deleteAt: new Date(now.getTime() + KEEP_MS),
  });
  const task = inBackground(record._id, run);
  // Nothing to ask the AI: the key costs nothing, it is answered now.
  if (!plan.calls) await task;
  return readGuard(String(record._id), user);
}

module.exports = {
  guardRunsSettled,
  readGuard,
  startGuard,
  MAX_RUNNING,
  RUN_MS,
};
