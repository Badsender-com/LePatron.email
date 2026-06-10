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

const schemas = Object.freeze({
  genericTextInput,
  genericTextOutput,
});

/**
 * @param {string} schemaId
 * @returns {import('zod').ZodTypeAny | undefined}
 */
function getSchema(schemaId) {
  return schemas[schemaId];
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
