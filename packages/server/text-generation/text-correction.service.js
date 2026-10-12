'use strict';

const { z } = require('zod');

const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const {
  locateCorrection,
} = require('../../shared/text-correction/place-correction.js');
const {
  readRequest,
  prepare,
  toSkillExpertise,
  toConsumed,
  toHttpError,
} = require('./invocation-context.js');

/**
 * Spelling correction (ADR 0005): the corrections of the spelling, grammar and
 * typography of the fields of one block, an action of text generation.
 *
 * The skill reads the visible text of each field and answers corrections; the
 * code keeps only those it can place in the text it sent — found once, whole
 * words, touching no merge tag, changing something, on a field it sent. The
 * editor places them again in the HTML when the user accepts one.
 */

// A block's fields, each a few lines of an email: these keep a request to a
// block, not a document. The AI rate limit caps the request itself.
const MAX_FIELDS = 60;
const MAX_FIELD_LENGTH = 5000;

const requestSchema = z.object({
  mailingId: z.string().min(1),
  target: z.object({
    kind: z.enum(['blockField', 'block']),
    blockId: z.string().min(1),
    blockType: z.string().min(1),
    field: z.string().optional(),
  }),
  fields: z
    .array(
      z.object({
        path: z.string().min(1),
        role: z.enum(['title', 'text', 'button', 'alt']),
        text: z.string().min(1).max(MAX_FIELD_LENGTH),
      })
    )
    .min(1)
    .max(MAX_FIELDS),
});

// Corrections the code can place in the text it sent; the others are counted.
function screenCorrections(corrections, fields) {
  const textOf = new Map(fields.map((field) => [field.path, field.text]));
  const kept = corrections.filter((correction) => {
    const text = textOf.get(correction.field);
    return text !== undefined && !locateCorrection(text, correction).refused;
  });
  return { corrections: kept, dropped: corrections.length - kept.length };
}

/**
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, target, fields: [{ path, role, text }] }
 * @returns {Promise<{ corrections: Array, dropped: number }>}
 */
async function correctText({ user, body }) {
  const request = readRequest(requestSchema, body);
  const prepared = await prepare({
    user,
    mailingId: request.mailingId,
    scope: 'correction',
    byEmailType: false,
  });
  // Only the expertise written for correcting: the transversal writing
  // principles would push the skill towards rewriting.
  const expertise = prepared.expertise.filter((e) => !e.isTransversal);

  let result;
  try {
    result = await skillInvocation.invoke({
      skillId: 'redaction.correction',
      featureType: AIFeatureTypes.TEXT_GENERATION,
      invocationSource: 'text-generation.correction',
      groupId: prepared.groupId,
      userId: user.id,
      input: {
        fields: request.fields,
        expertise: expertise.map(toSkillExpertise),
      },
      expertiseConsumed: expertise.map(toConsumed),
    });
  } catch (err) {
    throw toHttpError(err);
  }

  return screenCorrections(result.output.corrections, request.fields);
}

module.exports = { correctText };
