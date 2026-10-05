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
const { screenProposals } = require('./proposal-checks.js');

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

// Writing doctrine, and the deliverability doctrine that keeps the promise of a
// subject honest.
const EXPERTISE_CATEGORIES = ['redaction', 'deliverability'];

const optionalText = z
  .string()
  .optional()
  // An empty field is no instruction: the skill should not read "".
  .transform((value) => (value && value.trim() ? value : undefined));

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
  avoid: z.array(z.string()).max(30).optional(),
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
      categories: EXPERTISE_CATEGORIES,
      emailType: emailType || undefined,
    })
  );

  return {
    // A super admin has no group of their own: the mailing's company pays.
    groupId: (user.group && user.group.id) || mailing._company,
    emailType: emailType || undefined,
    expertise,
  };
}

/**
 * Turn an invocation failure into what the user can act on. The detail stays in
 * the invocation log.
 */
function toHttpError(err) {
  if (err && err.featureResolutionReason) {
    return createError(403, ERROR_CODES.TEXT_GENERATION_DISABLED);
  }
  if (err && err.invocationStatus === InvocationStatuses.CONFIG_ERROR) {
    return createError(503, ERROR_CODES.TEXT_GENERATION_UNAVAILABLE);
  }
  if (
    err &&
    [
      InvocationStatuses.PROVIDER_ERROR,
      InvocationStatuses.TIMEOUT,
      InvocationStatuses.VALIDATION_ERROR,
    ].includes(err.invocationStatus)
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

  return screenProposals('subject', result.output.proposals, request.content);
}

module.exports = { generateSubjects };
