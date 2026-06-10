'use strict';

const { describeSchema } = require('../schemas/describe-schema.js');

/**
 * Coherence check between a skill version's inputTemplate and the skill's
 * inputSchemaId. With strict zod input schemas, a `{{input.x}}` placeholder
 * whose field does not exist in the schema is ALWAYS interpolated empty —
 * a guaranteed content bug, not a design choice.
 *
 * Severity is decided by the caller:
 *   - DRAFT save     → both lists are non-blocking warnings;
 *   - activation     → unknownFields blocks, missingRequired stays a warning
 *                      (omitting a required field can be intentional).
 */

// First segment of each placeholder only (nested paths validated on their
// root in v1): {{input.foo.bar}} → 'foo'.
const PLACEHOLDER_FIELD_REGEX = /\{\{\s*input\.([a-zA-Z0-9_]+)/g;

/**
 * @param {string} inputTemplate
 * @param {string} inputSchemaId
 * @returns {{ unknownFields: string[], missingRequired: string[] }}
 *   Empty lists when the schema is unknown (nothing to validate against).
 */
function validateTemplateCoherence(inputTemplate, inputSchemaId) {
  const descriptor = describeSchema(inputSchemaId);
  if (!descriptor) return { unknownFields: [], missingRequired: [] };

  const referenced = new Set();
  for (const match of String(inputTemplate || '').matchAll(
    PLACEHOLDER_FIELD_REGEX
  )) {
    referenced.add(match[1]);
  }

  const validNames = new Set(descriptor.fields.map((f) => f.name));
  // {{input.expertise}} is valid iff the schema accepts an expertise field.
  if (descriptor.hasExpertiseField) validNames.add('expertise');

  const unknownFields = [...referenced].filter((name) => !validNames.has(name));
  const missingRequired = descriptor.fields
    .filter((f) => f.required && !referenced.has(f.name))
    .map((f) => f.name);

  return { unknownFields, missingRequired };
}

/**
 * Human-readable warnings for a DRAFT save response (UI display).
 * @returns {string[]}
 */
function templateWarnings(inputTemplate, inputSchemaId) {
  const { unknownFields, missingRequired } = validateTemplateCoherence(
    inputTemplate,
    inputSchemaId
  );
  const warnings = [];
  if (unknownFields.length) {
    warnings.push(
      'Le template référence des champs absents du schéma d\'entrée ' +
        `« ${inputSchemaId} » : ${unknownFields.join(', ')}. ` +
        'Ils seront interpolés vides à l\'exécution — la publication sera bloquée.'
    );
  }
  if (missingRequired.length) {
    warnings.push(
      `Champ(s) requis du schéma « ${inputSchemaId} » non référencé(s) dans le ` +
        `template : ${missingRequired.join(', ')}.`
    );
  }
  return warnings;
}

module.exports = { validateTemplateCoherence, templateWarnings };
