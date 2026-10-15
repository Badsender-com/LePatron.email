'use strict';

const createError = require('http-errors');

const expertiseRepo = require('../ai-skill/repositories/expertise.repository.js');
const mailingService = require('../mailing/mailing.service.js');
const mailingMetadataService = require('../mailing/mailing-metadata.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const {
  InvocationStatuses,
} = require('../ai-skill/constant/skill-constants.js');
const { Templates } = require('../common/models.common.js');
const {
  PROVIDER_ERROR_CODES,
} = require('../integration-providers/provider-error.js');
const manifest = require('./skill-manifest.js');

/**
 * What every action of text generation shares around its invocation (ADR 0003,
 * ADR 0005): reading the request, access to the mailing, the expertises of a
 * scope, the group billed, and turning a failure into what the user can act on.
 */

// The expertise each invocation reads, as the manifest declares it: one
// declaration for this code, `yarn check-skills` and the activation alert.
const expertiseFilter = (scope) =>
  manifest.expertiseFilters.find((f) => f.scope.includes(scope));

function readRequest(schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw createError(400, ERROR_CODES.INVALID_TEXT_GENERATION_REQUEST);
  }
  return parsed.data;
}

// The fields a skill reads; the repository's bookkeeping stays out of the prompt.
const toSkillExpertise = ({
  expertiseId,
  title,
  body,
  examplesGood,
  examplesBad,
}) => ({
  expertiseId,
  title,
  body,
  examplesGood,
  examplesBad,
});

const toConsumed = ({ expertiseId, versionMajor, versionMinor }) => ({
  expertiseId,
  versionMajor,
  versionMinor,
});

// Undefined fields are left out, so the skill never reads an empty tag as data.
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

/**
 * The group whose engine serves the request and whose quota it counts against.
 *
 * A regular user only reaches the mailings of their own group. A super admin
 * has no group: the mailing's company pays — or, for a mailing an admin created
 * before companies were stamped on mailings, the company of its template, which
 * is the group the editor asked to show the button for.
 */
async function billedGroupId(user, mailing) {
  if (user.group?.id) return user.group.id;
  if (mailing._company) return mailing._company;
  const template = await Templates.findById(mailing._wireframe)
    .select({ _company: 1 })
    .lean();
  return template?._company;
}

/**
 * What every invocation of this feature starts from: access to the mailing, its
 * email type unless the scope ignores it, and the expertises of the scope.
 */
async function prepare({ user, mailingId, scope, byEmailType = true }) {
  const mailing = await mailingService.findOneForUser(mailingId, user);
  await mailingService.assertUserCanEditMailing(user, mailing);

  // Spelling does not depend on the email type: its expertise is never
  // filtered by it.
  const emailType = byEmailType
    ? await mailingMetadataService.findCanonicalEmailType(mailing)
    : null;
  const filter = expertiseFilter(scope);
  const applicable = await expertiseRepo.findApplicable(
    compact({
      scope,
      categories: filter.categories,
      emailType: emailType || undefined,
    })
  );
  const expertise = filter.excludeTransversal
    ? applicable.filter((e) => !e.isTransversal)
    : applicable;

  return {
    groupId: await billedGroupId(user, mailing),
    emailType: emailType || undefined,
    expertise,
  };
}

const ACCOUNT_FAILURES = new Set([
  PROVIDER_ERROR_CODES.INVALID_CREDENTIALS,
  PROVIDER_ERROR_CODES.QUOTA_EXCEEDED,
  PROVIDER_ERROR_CODES.CONFIG_ERROR,
]);

/**
 * Turn an invocation failure into what the user can act on. The detail stays in
 * the invocation log.
 */
function toHttpError(err) {
  if (err?.featureResolutionReason) {
    return createError(403, ERROR_CODES.TEXT_GENERATION_DISABLED);
  }
  // Failures that retrying will not fix: the skill refusing the input this
  // feature built (its active version expects another contract), or a provider
  // refusing the account itself — key, quota, credits, configuration. An
  // administrator has to act, so the user is told so, not to retry.
  const contractBroken = err?.skillError?.code === 'INPUT_VALIDATION';
  const accountRefused = ACCOUNT_FAILURES.has(err?.failureCode);
  if (
    err?.invocationStatus === InvocationStatuses.CONFIG_ERROR ||
    contractBroken ||
    accountRefused
  ) {
    return createError(503, ERROR_CODES.TEXT_GENERATION_UNAVAILABLE);
  }
  if (
    [
      InvocationStatuses.PROVIDER_ERROR,
      InvocationStatuses.TIMEOUT,
      InvocationStatuses.VALIDATION_ERROR,
    ].includes(err?.invocationStatus)
  ) {
    const failed = createError(502, ERROR_CODES.TEXT_GENERATION_FAILED);
    failed.invocationId = err.invocationId;
    return failed;
  }
  return err;
}

module.exports = {
  readRequest,
  prepare,
  compact,
  toSkillExpertise,
  toConsumed,
  toHttpError,
};
