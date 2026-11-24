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
const { resourceGroupIdOf } = require('../account/request-scope.js');
const manifest = require('./skill-manifest.js');
const { qualitySettingsOf } = require('./proposal-settings.js');
const {
  PROVIDER_ERROR_CODES,
} = require('../integration-providers/provider-error.js');

// What every action of text generation shares around its invocation (ADR 0016,
// ADR 0011): reading the request, the mailing the user may edit, the group of
// the request, the email type and the expertises of a scope, and turning a
// failure into what the user can act on.

// The expertise each invocation reads, as the manifest declares it: one
// declaration for this code, `yarn check-skills` and the activation alert.
const expertiseFilter = (scope) =>
  manifest.expertiseFilters.find((f) => f.scope.includes(scope));

// Undefined fields are left out, so the skill never reads an empty tag as data.
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

/**
 * The group of the request is the email's (ADR 0002), whoever asks: its engine
 * serves the request, its audience decides which skills and expertises apply,
 * its settings decide what is logged. A super admin's own group is the
 * platform's, never the one of the email it opens. A mailing created before
 * companies were stamped on mailings takes the company of its template, the
 * group the editor shows the button for.
 */
async function requestGroupId(user, mailing) {
  let groupId = mailing._company;
  if (!groupId) {
    const template = await Templates.findById(mailing._wireframe)
      .select({ _company: 1 })
      .lean();
    groupId = template?._company;
  }
  if (!groupId) throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  return resourceGroupIdOf(user, groupId);
}

// What the generation reads of the mailing: its group, its type, and where it
// lives for the right to edit it. Never its content: the editor sends the text
// it shows.
const MAILING_PROJECTION = {
  _company: 1,
  _wireframe: 1,
  _emailType: 1,
  _workspace: 1,
  _parentFolder: 1,
};

/**
 * What every invocation of this feature starts from: access to the mailing, its
 * group, its email type unless the scope ignores it, and the expertises of the
 * scope that group may read.
 */
async function prepare({ user, mailingId, scope, byEmailType = true }) {
  const mailing = await mailingService.findOneForUser(
    mailingId,
    user,
    MAILING_PROJECTION
  );
  await mailingService.assertUserCanEditMailing(user, mailing);
  const groupId = await requestGroupId(user, mailing);

  // Spelling does not depend on the email type: its expertise is never
  // filtered by it.
  const { emailType, untargetedOnly } = byEmailType
    ? await mailingMetadataService.findDoctrineEmailType(mailing)
    : {};
  const filter = expertiseFilter(scope);
  const applicable = await expertiseRepo.findApplicable(
    compact({
      scope,
      categories: filter.categories,
      emailType,
      untargetedOnly: untargetedOnly || undefined,
      groupId,
    })
  );
  const expertise = filter.excludeTransversal
    ? applicable.filter((e) => !e.isTransversal)
    : applicable;

  return {
    groupId,
    emailType,
    expertise,
    qualitySettings: await qualitySettingsOf(mailing),
  };
}

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
  // Failures that retrying will not fix: a skill missing or kept to the
  // platform company, the skill refusing the input this feature built (its
  // active version expects another contract), or a provider refusing the
  // account itself — key, credits, configuration. An administrator has to act,
  // so the user is told so, not to retry.
  const skillClosed =
    err?.message === ERROR_CODES.SKILL_NOT_AVAILABLE_TO_COMPANY;
  const contractBroken = err?.skillError?.code === 'INPUT_VALIDATION';
  const accountRefused = ACCOUNT_FAILURES.has(err?.failureCode);
  if (
    err?.invocationStatus === InvocationStatuses.CONFIG_ERROR ||
    skillClosed ||
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
