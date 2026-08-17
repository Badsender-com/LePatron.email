'use strict';

const { describeSchema } = require('../schemas/describe-schema.js');

/**
 * Coherence check between a skill version's inputTemplate and the skill's
 * inputSchemaId. With strict zod input schemas, a `{{input.x}}` placeholder
 * whose field does not exist in the schema is ALWAYS interpolated empty —
 * a guaranteed content bug, not a design choice.
 *
 * Severity is decided by the caller:
 *   - DRAFT save     → all findings are non-blocking warnings;
 *   - activation     → unknownFields blocks; missingRequired and
 *                      missingExpertise stay warnings (omitting them can be
 *                      intentional, but is worth flagging).
 */

// First segment of each placeholder only (nested paths validated on their
// root in v1): {{input.foo.bar}} → 'foo'.
const PLACEHOLDER_FIELD_REGEX = /\{\{\s*input\.([a-zA-Z0-9_]+)/g;

/**
 * @param {string} inputTemplate
 * @param {string} inputSchemaId
 * @returns {{ unknownFields: string[], missingRequired: string[], missingExpertise: boolean }}
 *   Empty/false when the schema is unknown (nothing to validate against).
 */
function validateTemplateCoherence(inputTemplate, inputSchemaId) {
  const descriptor = describeSchema(inputSchemaId);
  if (!descriptor) {
    return { unknownFields: [], missingRequired: [], missingExpertise: false };
  }

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
  // The schema accepts expertises but the template never inserts them: the
  // selected expertises would be silently dropped at invocation.
  const missingExpertise =
    !!descriptor.hasExpertiseField && !referenced.has('expertise');

  return { unknownFields, missingRequired, missingExpertise };
}

/**
 * Human-readable warnings for a DRAFT save response (UI display).
 * @returns {string[]}
 */
function templateWarnings(inputTemplate, inputSchemaId) {
  const {
    unknownFields,
    missingRequired,
    missingExpertise,
  } = validateTemplateCoherence(inputTemplate, inputSchemaId);
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
  if (missingExpertise) {
    warnings.push(
      'Le schéma accepte des expertises mais le template ne les insère pas : ' +
        'elles seraient ignorées à l\'invocation.'
    );
  }
  return warnings;
}

module.exports = { validateTemplateCoherence, templateWarnings };
