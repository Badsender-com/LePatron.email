'use strict';

/**
 * Production's answer to a copy (ADR 0019), read before anything is written:
 * the skills export, format 1, with every item, its state, its audience, its
 * served-to-assistants mark, its active version and its open draft. An answer
 * this copy cannot read is refused whole, so the follow writes nothing.
 */

const { z } = require('zod');
const { AudienceValues } = require('../constant/skill-constants.js');
const { FORMAT, ITEM_SCHEMAS } = require('./skills-export.format.js');

const followed = (schema) =>
  schema.extend({
    status: z.enum(['active', 'draft', 'archived']),
    audience: z.enum(AudienceValues),
    version: schema.shape.version.optional(),
    draft: schema.shape.version.optional(),
  });

const ANSWER = z
  .object({
    format: z.literal(FORMAT),
    origin: z.string(),
    exportedAt: z.string(),
    exportedBy: z.string(),
    expertises: z.array(followed(ITEM_SCHEMAS.expertise)),
    skills: z.array(
      followed(ITEM_SCHEMAS.skill).extend({
        servedToAssistants: z.boolean(),
      })
    ),
  })
  .passthrough();

// The page says "unreadable"; the message says where, for the logs.
const unreadable = (message) =>
  Object.assign(new Error(message), { reason: 'unreadable' });

/**
 * @param {Object} json production's answer
 * @returns {Object} the answer, typed
 * @throws {Error} saying why it cannot be read
 */
function readProductionAnswer(json) {
  if (!json || json.format !== FORMAT) {
    throw unreadable(
      `Production answered an unknown format (${
        json && json.format
      }); this copy reads format ${FORMAT}.`
    );
  }
  const parsed = ANSWER.safeParse(json);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw unreadable(
      `Production answered something this copy cannot read: ${issue.path.join(
        '.'
      )} ${issue.message}`
    );
  }
  return parsed.data;
}

module.exports = { readProductionAnswer };
