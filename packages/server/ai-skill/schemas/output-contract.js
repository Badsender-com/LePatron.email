'use strict';

const { z } = require('zod');
const { getSchema } = require('./index.js');

/**
 * Derive the output-format contract block from a skill's outputSchemaId.
 *
 * Systemic guard: a prompt that never states the JSON contract enforced by
 * the output zod schema is a guaranteed OUTPUT_PARSE failure. Authors must
 * NOT write format instructions manually anymore — this block is injected
 * automatically at prompt build time, appended to the STATIC section of the
 * prompt (deterministic per skill version → prompt-caching friendly).
 *
 * French on purpose: skill prompts are written in French by convention.
 */

/**
 * @param {string} outputSchemaId
 * @returns {string|null} the contract block, or null when the schema is
 *   unknown/absent (no injection, current behaviour preserved).
 */
function buildOutputContract(outputSchemaId) {
  const schema = outputSchemaId && getSchema(outputSchemaId);
  if (!schema) return null;

  let jsonSchema;
  try {
    jsonSchema = z.toJSONSchema(schema);
  } catch (e) {
    // Non-representable schema (lazy, transforms…): better no contract than
    // a crash at invocation time.
    return null;
  }
  // The $schema meta key is spec noise for an LLM — drop it for brevity.
  delete jsonSchema.$schema;

  return [
    '## Format de sortie (obligatoire)',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après,',
    'conforme à ce schéma :',
    JSON.stringify(jsonSchema, null, 2),
    'Respecte STRICTEMENT les types du schéma : une propriété de type "string"',
    'contient du texte (du Markdown si la réponse est structurée), JAMAIS un',
    'objet ou un tableau imbriqué.',
    'Ne pose jamais de question en retour : si une information manque,',
    'fais des hypothèses raisonnables et produis quand même la sortie.',
  ].join('\n');
}

module.exports = { buildOutputContract };
