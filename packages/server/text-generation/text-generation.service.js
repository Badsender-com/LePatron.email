'use strict';

const createError = require('http-errors');
const { z } = require('zod');

const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const expertiseRepo = require('../ai-skill/repositories/expertise.repository.js');
const mailingService = require('../mailing/mailing.service.js');
const mailingMetadataService = require('../mailing/mailing-metadata.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const ERROR_CODES = require('../constant/error-codes.js');
const {
  InvocationStatuses,
} = require('../ai-skill/constant/skill-constants.js');
const { Templates } = require('../common/models.common.js');
const { screenProposals } = require('./proposal-checks.js');
const {
  PROVIDER_ERROR_CODES,
} = require('../integration-providers/provider-error.js');
const manifest = require('./skill-manifest.js');

/**
 * Text generation: the subject and the preheader of an email (ADR 0003).
 *
 * This feature composes; it does not write prompts. For each invocation it
 * gathers the email as the editor shows it, the email type when the mailing has
 * one, and the expertises of one scope, then hands them to a skill written by
 * consultants. Subject and preheader are two invocations: the preheader is built
 * from the subject the user picked, so the chaining lives here and in the
 * editor, never from one skill to another.
 */

// The expertise each invocation reads, as the manifest declares it: one
// declaration for this code, `yarn check-skills` and the activation alert.
function expertiseCategories(scope) {
  const filter = manifest.expertiseFilters.find((f) => f.scope.includes(scope));
  return filter.categories;
}

// What the user may write into the prompt. The AI rate limit caps the request;
// these keep the user's share of the prompt to an instruction, not a document.
const MAX_BRIEF_LENGTH = 500;
const MAX_AVOID_LENGTH = 300;
const MAX_AVOID_ITEMS = 30;

const optionalText = z
  .string()
  .max(MAX_BRIEF_LENGTH)
  .optional()
  // An empty field is no instruction: the skill should not read "".
  .transform((value) => (value?.trim() ? value : undefined));

const requestSchema = z.object({
  mailingId: z.string().min(1),
  content: z
    .array(
      z.object({
        role: z.enum(['title', 'text', 'button']),
        text: z.string().refine((text) => text.trim().length > 0),
      })
    )
    .min(1),
  brief: optionalText,
  avoid: z
    .array(z.string().max(MAX_AVOID_LENGTH))
    .max(MAX_AVOID_ITEMS)
    .optional(),
});

const subjectRequestSchema = requestSchema.extend({
  currentSubject: optionalText,
});

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
 * email type, and the expertises of the scope.
 */
async function prepare({ user, mailingId, scope }) {
  const mailing = await mailingService.findOneForUser(mailingId, user);
  await mailingService.assertUserCanEditMailing(user, mailing);

  const emailType = await mailingMetadataService.findCanonicalEmailType(
    mailing
  );
  const expertise = await expertiseRepo.findApplicable(
    compact({
      scope,
      categories: expertiseCategories(scope),
      emailType: emailType || undefined,
    })
  );

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

/**
 * Three subject proposals for the email the user is editing.
 *
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, content, currentSubject?, brief?, avoid? }
 * @returns {Promise<{ proposals: Array, dropped: number }>}
 */
async function generateSubjects({ user, body }) {
  const request = readRequest(subjectRequestSchema, body);
  const { groupId, emailType, expertise } = await prepare({
    user,
    mailingId: request.mailingId,
    scope: 'subject',
  });

  let result;
  try {
    result = await skillInvocation.invoke({
      skillId: 'redaction.objet',
      featureType: AIFeatureTypes.TEXT_GENERATION,
      invocationSource: 'text-generation.subject',
      groupId,
      userId: user.id,
      input: compact({
        content: request.content,
        emailType,
        currentSubject: request.currentSubject,
        brief: request.brief,
        avoid: request.avoid,
        expertise: expertise.map(toSkillExpertise),
      }),
      expertiseConsumed: expertise.map(toConsumed),
    });
  } catch (err) {
    throw toHttpError(err);
  }

  return screenProposals('subject', result.output.proposals, {
    sources: [
      ...request.content.map((piece) => piece.text),
      request.currentSubject || '',
    ],
    avoid: request.avoid,
  });
}

module.exports = { generateSubjects };
