'use strict';

const { z } = require('zod');

const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const { FIELD_ROLES } = require('../ai-skill/schemas/index.js');
const {
  locateCorrection,
  isNoLoss,
} = require('../../shared/text-correction/place-correction.js');
const { isRewrite } = require('../../shared/text-correction/rewrite.js');
const {
  MAX_FIELDS,
  MAX_FIELD_LENGTH,
  MAX_TOTAL_LENGTH,
  MAX_PATH_LENGTH,
  MAX_BLOCK_ID_LENGTH,
  sentLength,
} = require('../../shared/text-correction/correction-limits.js');
const {
  readRequest,
  prepare,
  toSkillExpertise,
  toConsumed,
  toHttpError,
} = require('./invocation-context.js');

/**
 * Spelling correction (ADR 0011): the corrections of the spelling, grammar and
 * typography of the fields of a block, or of a few consecutive blocks, an
 * action of text generation.
 *
 * The skill reads the visible text of each field and answers corrections; the
 * code keeps only those it can place in the text it sent — found once, whole
 * words, touching no merge tag, changing something, on a field it sent. The
 * editor places them again in the HTML when the user accepts one.
 *
 * A correction changing more than three words is a rewrite: returned all the
 * same, marked `rewrite: true` for the panel to say so.
 */

const blockId = z.string().min(1).max(MAX_BLOCK_ID_LENGTH);
const blockType = z.string().min(1).max(MAX_BLOCK_ID_LENGTH);

const requestSchema = z
  .object({
    mailingId: z.string().min(1),
    // A field or a block; or consecutive blocks, each field naming its own.
    target: z.union([
      z
        .object({
          kind: z.enum(['blockField', 'block']),
          blockId,
          blockType,
          field: z.string().min(1).max(MAX_PATH_LENGTH).optional(),
        })
        .strict(),
      z
        .object({
          kind: z.literal('blocks'),
          blocks: z
            .array(z.object({ blockId, blockType }).strict())
            .min(1)
            .max(MAX_FIELDS),
        })
        .strict(),
    ]),
    fields: z
      .array(
        z.object({
          blockId: blockId.optional(),
          path: z.string().min(1).max(MAX_PATH_LENGTH),
          role: z.enum(FIELD_ROLES),
          text: z.string().min(1).max(MAX_FIELD_LENGTH),
        })
      )
      .min(1)
      .max(MAX_FIELDS),
  })
  .superRefine(({ target, fields }, ctx) => {
    const issue = (message) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const keys = fields.map((field) => `${field.blockId}\n${field.path}`);
    if (new Set(keys).size !== keys.length) issue('a field sent twice');
    const total = fields.reduce((sum, field) => sum + sentLength(field), 0);
    if (total > MAX_TOTAL_LENGTH) issue('more text than a request holds');
    if (target.kind === 'blocks') {
      const named = target.blocks.map((block) => block.blockId);
      if (new Set(named).size !== named.length) issue('a block named twice');
      const sent = new Set(fields.map((field) => field.blockId));
      if (fields.some((field) => !named.includes(field.blockId))) {
        issue('a field of a block the target does not name');
      }
      if (named.some((id) => !sent.has(id))) issue('a block without field');
      return;
    }
    if (fields.some((field) => field.blockId !== undefined)) {
      issue('a field or block target names no block per field');
    }
    // A field target sends that field alone; a block target names none.
    if (target.kind === 'blockField') {
      if (fields.length !== 1 || fields[0].path !== target.field) {
        issue('a field target sends its field alone');
      }
    } else if (target.field !== undefined) {
      issue('a block target names no field');
    }
  });

// The skill reads each field by a key unique in the request: its path within
// one block, its path behind its block's rank across several. Its contract
// stays one list of fields; each correction comes back to its block and path.
function skillFieldsOf({ target, fields }) {
  if (target.kind !== 'blocks') {
    return fields.map((field) => ({ key: field.path, field }));
  }
  const rank = new Map(target.blocks.map((block, i) => [block.blockId, i + 1]));
  return fields.map((field) => ({
    key: `${rank.get(field.blockId)}:${field.path}`,
    field,
  }));
}

// The model can neither write a non-breaking space nor tell one from a space
// (#1258): the skill reads and writes it as this marker, which the code turns
// back into the character.
const NBSP_MARKER = '{nbsp}';
const toSkillText = (text) => text.replace(/\u00a0/g, NBSP_MARKER);
const fromSkillText = (text) => text.split(NBSP_MARKER).join('\u00a0');
const fromSkill = (correction) => ({
  ...correction,
  before: fromSkillText(correction.before),
  after: fromSkillText(correction.after),
});

// Corrections the code can place in the text it sent, a rewrite marked; the
// others are counted, except those that are no loss: changing nothing, or
// already in the text.
function screenCorrections(corrections, fields) {
  const textOf = new Map(fields.map((field) => [field.path, field.text]));
  // A correction the model repeats is one correction.
  const seen = new Set();
  const unique = corrections.filter((correction) => {
    const key = JSON.stringify([
      correction.field,
      correction.before,
      correction.after,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let dropped = 0;
  const kept = unique.filter((correction) => {
    const text = textOf.get(correction.field);
    const located =
      text === undefined
        ? { refused: 'not-found' }
        : locateCorrection(text, correction);
    if (located.refused && !isNoLoss(located)) dropped += 1;
    return !located.refused;
  });
  return {
    corrections: kept.map((correction) =>
      isRewrite(correction.before, correction.after)
        ? { ...correction, rewrite: true }
        : correction
    ),
    dropped,
  };
}

/**
 * @param {Object} params
 * @param {Object} params.user the requesting user
 * @param {Object} params.body { mailingId, target, fields: [{ blockId?, path, role, text }] }
 * @returns {Promise<{ corrections: Array, dropped: number }>} each correction
 *   `{ field, before, after, reason }`, plus `rewrite: true` on a rewrite;
 *   across several blocks, each names its `blockId`
 */
async function correctText({ user, body }) {
  const request = readRequest(requestSchema, body);
  const prepared = await prepare({
    user,
    mailingId: request.mailingId,
    scope: 'correction',
    byEmailType: false,
  });
  const { expertise } = prepared;
  const keyed = skillFieldsOf(request);
  const sent = keyed.map(({ key, field }) => ({
    path: key,
    role: field.role,
    text: field.text,
  }));

  let result;
  try {
    result = await skillInvocation.invoke({
      skillId: 'redaction.correction',
      featureType: AIFeatureTypes.TEXT_GENERATION,
      invocationSource: 'text-generation.correction',
      groupId: prepared.groupId,
      userId: user.id,
      input: {
        fields: sent.map((field) => ({
          ...field,
          text: toSkillText(field.text),
        })),
        expertise: expertise.map(toSkillExpertise),
      },
      expertiseConsumed: expertise.map(toConsumed),
    });
  } catch (err) {
    throw toHttpError(err);
  }

  const screened = screenCorrections(
    result.output.corrections.map(fromSkill),
    sent
  );
  if (request.target.kind !== 'blocks') return screened;
  const fieldOf = new Map(keyed.map(({ key, field }) => [key, field]));
  return {
    ...screened,
    corrections: screened.corrections.map((correction) => {
      const field = fieldOf.get(correction.field);
      return { ...correction, blockId: field.blockId, field: field.path };
    }),
  };
}

module.exports = { correctText };
