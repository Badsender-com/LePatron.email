'use strict';

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const { AISkillInvocations, Groups } = require('../../common/models.common.js');
const {
  InvocationStatuses,
  DefaultLogRetentionDays,
} = require('../constant/skill-constants.js');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deadline stamped on every invocation, consumed by the TTL index on
 * AISkillInvocation.expiresAt. Retention is a per-Group setting, so it cannot
 * live in the index itself.
 *
 * @param {Date} startedAt
 * @param {number} retentionDays
 * @returns {Date}
 */
function computeExpiresAt(startedAt, retentionDays) {
  const days = retentionDays || DefaultLogRetentionDays;
  const from = startedAt instanceof Date ? startedAt : new Date();
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/**
 * The Group's retention, from the caller when it already loaded the Group.
 *
 * The INPUT_VALIDATION failure path logs before the Group document is fetched
 * (nothing has been sent to a provider at that point), so this reads it rather
 * than falling back to the default: a Group that asked for 7 days must not end
 * up keeping a log carrying its input for 30.
 *
 * @returns {Promise<number|undefined>}
 */
async function resolveRetentionDays(params) {
  if (typeof params.retentionDays === 'number') return params.retentionDays;
  if (!params.groupId) return undefined;
  try {
    const group = await Groups.findById(params.groupId, {
      logRetentionDays: 1,
    }).lean();
    return group ? group.logRetentionDays : undefined;
  } catch (err) {
    logger.error('Failed to read Group retention:', err.message);
    return undefined;
  }
}

/**
 * Persist an AISkillInvocation document. Failure to log is swallowed (logged
 * via logger but never throws) so a flaky write never breaks an invocation.
 *
 * @returns {Promise<import('mongoose').Types.ObjectId | null>}
 */
async function logInvocation(params) {
  if (params.skipLogging) return null;
  const allowContent = params.allowContent !== false;
  const startedAt = params.startedAt;
  const doc = {
    _skill: params.skill._id,
    skillId: params.skill.skillId,
    skillVersion: `${params.version.versionMajor}.${params.version.versionMinor}`,
    _company: params.groupId,
    _user: params.userId || null,
    invocationSource: params.invocationSource || null,
    variantPath: params.variantPath || [],
    provider: params.resolvedConfig ? params.resolvedConfig.provider : null,
    model: params.resolvedConfig ? params.resolvedConfig.model : null,
    input: allowContent ? params.input : null,
    output: allowContent ? params.output : null,
    rawOutput: allowContent ? params.rawOutput : null,
    resolvedConfig: params.resolvedConfig,
    tokenUsage: params.tokenUsage,
    startedAt,
    expiresAt: computeExpiresAt(startedAt, await resolveRetentionDays(params)),
    completedAt: params.completedAt,
    latencyMs: params.latencyMs,
    status: params.status,
    error: params.error || null,
  };
  try {
    const saved = await AISkillInvocations.create(doc);
    return saved._id;
  } catch (err) {
    logger.error('Failed to log AISkillInvocation:', err.message);
    return null;
  }
}

/**
 * Log a failed invocation and re-throw as an http-error so the controller
 * surfaces the right status code.
 */
async function logFailure(params) {
  const completedAt = new Date();
  const invocationId = await logInvocation({
    ...params,
    completedAt,
    latencyMs: completedAt - params.startedAt,
    output: null,
    // The Group's logSkillInvocationContent opt-out applies to failures too —
    // callers pass allowContent once the group is resolved (default: allowed).
    allowContent: params.allowContent,
  });
  // What reaches the client, and what does not.
  //
  // INPUT_VALIDATION is about the caller's own payload: our own zod formatting,
  // safe and actionable, and it powers the inline field errors. Everything else
  // describes what happened downstream — provider error text, model names, API
  // hosts, or a fragment of an unparseable LLM response — and has no business
  // in an HTTP body. The full detail is persisted in AISkillInvocation.error,
  // which the Invocations tab already displays, so `invocationId` is the handle
  // to it.
  const isCallerInputError =
    params.error && params.error.code === 'INPUT_VALIDATION';
  const err = createError(
    params.status === InvocationStatuses.VALIDATION_ERROR ? 400 : 502,
    isCallerInputError ? params.error.message : 'Skill invocation failed'
  );
  err.invocationId = invocationId;
  err.invocationStatus = params.status;
  if (isCallerInputError) err.skillError = params.error;
  // Transient decoration for UI consumption (inline field errors). Never
  // persisted: logInvocation builds its doc from explicit picks and `error`
  // is a typed subdoc — fieldErrors must stay out of both.
  if (params.fieldErrors) err.fieldErrors = params.fieldErrors;
  throw err;
}

function formatZodError(err) {
  if (!err || !err.issues) return 'Validation failed';
  return err.issues
    .map((i) => `${(i.path || []).join('.') || '<root>'}: ${i.message}`)
    .join('; ');
}

function callWithTimeout(promise, ms) {
  let timeoutHandle;
  const timeout = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      const e = new Error(`Skill invocation timed out after ${ms}ms`);
      e.code = 'SKILL_TIMEOUT';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutHandle)
  );
}

function truncate(str, max) {
  if (typeof str !== 'string') return str;
  return str.length > max ? str.substring(0, max) + '…' : str;
}

module.exports = {
  computeExpiresAt,
  logInvocation,
  logFailure,
  formatZodError,
  callWithTimeout,
  truncate,
};
