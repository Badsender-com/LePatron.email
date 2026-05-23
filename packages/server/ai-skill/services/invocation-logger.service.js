'use strict';

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const { AISkillInvocations } = require('../../common/models.common.js');
const { InvocationStatuses } = require('../constant/skill-constants.js');

/**
 * Persist an AISkillInvocation document. Failure to log is swallowed (logged
 * via logger but never throws) so a flaky write never breaks an invocation.
 *
 * @returns {Promise<import('mongoose').Types.ObjectId | null>}
 */
async function logInvocation(params) {
  if (params.skipLogging) return null;
  const allowContent = params.allowContent !== false;
  const doc = {
    _skill: params.skill._id,
    skillId: params.skill.skillId,
    skillVersion: `${params.version.versionMajor}.${params.version.versionMinor}`,
    _company: params.groupId,
    _user: params.userId || null,
    featureType: params.featureType || null,
    variantPath: params.variantPath || [],
    provider: params.resolvedConfig ? params.resolvedConfig.provider : null,
    model: params.resolvedConfig ? params.resolvedConfig.model : null,
    input: allowContent ? params.input : null,
    output: allowContent ? params.output : null,
    rawOutput: allowContent ? params.rawOutput : null,
    resolvedConfig: params.resolvedConfig,
    tokenUsage: params.tokenUsage,
    startedAt: params.startedAt,
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
    allowContent: true,
  });
  const err = createError(
    params.status === InvocationStatuses.VALIDATION_ERROR ? 400 : 502,
    params.error.message
  );
  err.invocationId = invocationId;
  err.invocationStatus = params.status;
  err.skillError = params.error;
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
  logInvocation,
  logFailure,
  formatZodError,
  callWithTimeout,
  truncate,
};
