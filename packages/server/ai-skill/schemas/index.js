'use strict';

const { z } = require('zod');

/**
 * Zod schema registry for LePatron Skills IA.
 *
 * Each skill in DB references an input/output schema by id (skillId.inputSchemaId
 * and outputSchemaId fields). Schemas live in this repo because they are part of
 * the API contract between skills and their callers — versioned via git, not DB.
 *
 * Adding a new schema: declare it below, export it through the `schemas` map.
 * Removing or breaking changes: create a new constant (e.g. `redactionCtaInputV2`)
 * rather than mutating the previous one. See ARCHITECTURE-CIBLE §6.1.
 */

// --- Shared sub-schemas ---

// Shape of the expertise entries the playground runner injects into the input
// (only when at least one expertise resolves). Any skill that consumes
// expertise must declare `expertise: expertiseArraySchema.optional()` in its
// input schema — reuse this constant in future typed schemas
// (redactionCtaInput, qcSubjectInput, …).
const expertiseArraySchema = z.array(
  z.object({
    expertiseId: z.string(),
    title: z.string(),
    body: z.string(),
    examplesGood: z.array(z.string()).optional(),
    examplesBad: z.array(z.string()).optional(),
  })
);

// --- Generic demonstration schemas (used by the seed skill `generic.text`) ---

const genericTextInput = z
  .object({
    prompt: z.string().min(1),
    context: z.string().optional(),
    expertise: expertiseArraySchema.optional(),
  })
  .strict();

const genericTextOutput = z
  .object({
    text: z.string(),
  })
  .strict();

// --- Text generation (subject, preheader) ---

// The email as the editor shows it: each piece of text with its role, in
// reading order. Built by the editor, never by the skill.
const emailCopySchema = z
  .array(
    z
      .object({
        role: z.enum(['title', 'text', 'button']),
        text: z.string().min(1),
      })
      .strict()
  )
  .min(1);

// Three proposals exactly: the feature shows them side by side, and a skill
// that answers two has not done its job.
const textProposalsOutput = z
  .object({
    proposals: z
      .array(
        z
          .object({
            text: z.string().min(1),
            angle: z.string().min(1),
          })
          .strict()
      )
      .length(3),
  })
  .strict();

const subjectGenInput = z
  .object({
    content: emailCopySchema,
    emailType: z.string().optional(),
    currentSubject: z.string().optional(),
    brief: z.string().optional(),
    // The proposals the user already saw: the skill moves away from them.
    avoid: z.array(z.string()).optional(),
    expertise: expertiseArraySchema.optional(),
  })
  .strict();

const subjectGenOutput = textProposalsOutput;

const preheaderGenInput = z
  .object({
    content: emailCopySchema,
    // The subject the user picked: the preheader complements it. Absent when
    // the subject is set elsewhere: the preheader carries the main point.
    subject: z.string().min(1).optional(),
    emailType: z.string().optional(),
    currentPreheader: z.string().optional(),
    brief: z.string().optional(),
    avoid: z.array(z.string()).optional(),
    expertise: expertiseArraySchema.optional(),
  })
  .strict();

const preheaderGenOutput = textProposalsOutput;

const schemas = Object.freeze({
  genericTextInput,
  genericTextOutput,
  subjectGenInput,
  subjectGenOutput,
  preheaderGenInput,
  preheaderGenOutput,
});

/**
 * @param {string} schemaId
 * @returns {import('zod').ZodTypeAny | undefined}
 */
function getSchema(schemaId) {
  // Via hasSchema rather than a bare lookup: `getSchema('constructor')` would
  // otherwise return a truthy non-schema and blow up on .safeParse.
  return hasSchema(schemaId) ? schemas[schemaId] : undefined;
}

/**
 * @returns {string[]}
 */
function listSchemaIds() {
  return Object.keys(schemas);
}

/**
 * @param {string} schemaId
 * @returns {boolean}
 */
function hasSchema(schemaId) {
  return Object.prototype.hasOwnProperty.call(schemas, schemaId);
}

module.exports = {
  schemas,
  getSchema,
  listSchemaIds,
  hasSchema,
  expertiseArraySchema,
};
