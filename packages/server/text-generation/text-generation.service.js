'use strict';

const { z } = require('zod');

const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const { screenProposals } = require('./proposal-checks.js');
const {
  readRequest,
  prepare,
  compact,
  toSkillExpertise,
  toConsumed,
  toHttpError,
} = require('./invocation-context.js');

/**
 * Text generation: the subject and the preheader of an email (ADR 0003).
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

const preheaderRequestSchema = requestSchema.extend({
  // Absent when the subject is set in the sending platform: the skill then
  // makes the preheader carry the main point of the email.
  subject: optionalText,
  currentPreheader: optionalText,
});

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

/**
 * Three preheader proposals that complement the subject the user picked, or
 * carry the main point of the email when it has no subject yet.
 *
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, content, subject?, currentPreheader?, brief?, avoid? }
 * @returns {Promise<{ proposals: Array, dropped: number }>}
 */
async function generatePreheaders({ user, body }) {
  const request = readRequest(preheaderRequestSchema, body);
  const { groupId, emailType, expertise } = await prepare({
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
  });
}

module.exports = { generateSubjects, generatePreheaders };
