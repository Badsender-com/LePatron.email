'use strict';

const createError = require('http-errors');
const { z } = require('zod');

const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const ERROR_CODES = require('../constant/error-codes.js');
const {
  InvocationStatuses,
} = require('../ai-skill/constant/skill-constants.js');
const { screenProposals } = require('./proposal-checks.js');
const {
  EMAIL_COPY_LIMITS,
} = require('../../shared/text-generation/email-copy-limits.js');
const { prepare, compact } = require('./invocation-context.js');
const {
  PROVIDER_ERROR_CODES,
} = require('../integration-providers/provider-error.js');

/**
 * Text generation: the subject and the preheader of an email (ADR 0016).
 *
 * This feature composes; it does not write prompts. For each invocation it
 * gathers the email as the editor shows it, the email type when the mailing has
 * one, and the expertises of one scope, then hands them to a skill written by
 * consultants. Subject and preheader are two invocations: the preheader is built
 * from the subject the user picked when there is one, so the chaining lives here
 * and in the editor, never from one skill to another.
 */

// What the user puts into the prompt: an instruction, the current subject or
// preheader. The AI rate limit caps the request; these keep the user's share of
// the prompt to a few lines, not a document.
const MAX_USER_TEXT_LENGTH = 500;
const MAX_AVOID_LENGTH = 300;
const MAX_AVOID_ITEMS = 30;

const optionalText = z
  .string()
  .max(MAX_USER_TEXT_LENGTH)
  .nullish()
  // An empty or null field says nothing: the skill should not read "".
  .transform((value) => (value?.trim() ? value : undefined));

const requestSchema = z.object({
  mailingId: z.string().min(1),
  content: z
    .array(
      z.object({
        role: z.enum(['title', 'text', 'button']),
        text: z
          .string()
          .max(EMAIL_COPY_LIMITS.maxTextLength)
          .refine((text) => text.trim().length > 0),
      })
    )
    .min(1)
    .max(EMAIL_COPY_LIMITS.maxItems)
    .refine(
      (content) =>
        content.reduce((total, piece) => total + piece.text.length, 0) <=
        EMAIL_COPY_LIMITS.maxTotalLength
    ),
  brief: optionalText,
  avoid: z
    .array(z.string().max(MAX_AVOID_LENGTH))
    .max(MAX_AVOID_ITEMS)
    .optional(),
});

const subjectRequestSchema = requestSchema.extend({
  currentSubject: optionalText,
});

const preheaderRequestSchema = requestSchema.extend({
  // Absent when the subject is set in the sending platform: the skill then
  // makes the preheader carry the main point of the email.
  subject: optionalText,
  currentPreheader: optionalText,
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

/**
 * Three subject proposals for the email the user is editing.
 *
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, content, currentSubject?, brief?, avoid? }
 * @returns {Promise<{ proposals: Array, dropped: number, repeated: number }>}
 */
async function generateSubjects({ user, body }) {
  const request = readRequest(subjectRequestSchema, body);
  const { groupId, emailType, expertise, qualitySettings } = await prepare({
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
    qualitySettings,
  });
}

/**
 * Three preheader proposals that complement the subject the user picked, or
 * carry the main point of the email when it has no subject yet.
 *
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, content, subject?, currentPreheader?, brief?, avoid? }
 * @returns {Promise<{ proposals: Array, dropped: number, repeated: number }>}
 */
async function generatePreheaders({ user, body }) {
  const request = readRequest(preheaderRequestSchema, body);
  const { groupId, emailType, expertise, qualitySettings } = await prepare({
    user,
    mailingId: request.mailingId,
    scope: 'preheader',
  });

  let result;
  try {
    result = await skillInvocation.invoke({
      skillId: 'redaction.pre-header',
      featureType: AIFeatureTypes.TEXT_GENERATION,
      invocationSource: 'text-generation.preheader',
      groupId,
      userId: user.id,
      input: compact({
        content: request.content,
        subject: request.subject,
        emailType,
        currentPreheader: request.currentPreheader,
        brief: request.brief,
        avoid: request.avoid,
        expertise: expertise.map(toSkillExpertise),
      }),
      expertiseConsumed: expertise.map(toConsumed),
    });
  } catch (err) {
    throw toHttpError(err);
  }

  return screenProposals('preheader', result.output.proposals, {
    sources: [
      ...request.content.map((piece) => piece.text),
      request.subject || '',
      request.currentPreheader || '',
    ],
    avoid: request.avoid,
    subject: request.subject,
    qualitySettings,
  });
}

module.exports = { generateSubjects, generatePreheaders };
