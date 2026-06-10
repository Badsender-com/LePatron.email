'use strict';

const { z } = require('zod');
const { getSchema } = require('./index.js');

/**
 * Build a UI-consumable descriptor of a registered zod input schema, so the
 * playground can render a plain form instead of a raw JSON textarea.
 *
 * Introspection relies only on zod's public API (instanceof + unwrap +
 * safeParse), verified against the installed zod 4.4.3. A manually declared
 * descriptor was rejected on purpose: it would silently drift from the
 * `.strict()` schema and produce forms whose output fails validation.
 *
 * The `expertise` field is NEVER part of `fields`: the playground runner
 * injects it from the scenario's expertise selection — consultants must not
 * type it by hand. Its presence is signalled via `hasExpertiseField`.
 */

const EXPERTISE_FIELD = 'expertise';

/**
 * Unwrap ZodOptional/ZodDefault wrappers down to the inner schema.
 */
function unwrapField(zodField) {
  let inner = zodField;
  // Bounded loop: wrappers can nest (optional(default(...))) but not deeply.
  for (let i = 0; i < 10; i++) {
    if (inner instanceof z.ZodOptional) {
      inner = inner.unwrap();
    } else if (inner instanceof z.ZodDefault) {
      // zod 4: ZodDefault exposes unwrap() on this version, but def.innerType
      // is the documented escape hatch — support both.
      inner =
        typeof inner.unwrap === 'function'
          ? inner.unwrap()
          : inner.def.innerType;
    } else {
      return inner;
    }
  }
  return inner;
}

/**
 * @returns {{ name: string, type: 'string'|'number'|'boolean'|'unknown', required: boolean, multiline: boolean }}
 */
function describeField(name, zodField) {
  // Covers .optional() AND .default(): both accept undefined.
  const required = !zodField.safeParse(undefined).success;
  const inner = unwrapField(zodField);

  let type = 'unknown';
  if (inner instanceof z.ZodString) type = 'string';
  else if (inner instanceof z.ZodNumber) type = 'number';
  else if (inner instanceof z.ZodBoolean) type = 'boolean';

  return {
    name,
    type,
    required,
    // v1 rule: every string renders as a textarea (a short value in a
    // textarea is harmless; the reverse is not).
    multiline: type === 'string',
  };
}

/**
 * @param {string} schemaId
 * @returns {{ schemaId: string, fields: Array, hasExpertiseField: boolean } | null}
 *   null when the schemaId is not in the registry (controller turns it into 404).
 */
function describeSchema(schemaId) {
  const schema = getSchema(schemaId);
  if (!schema) return null;

  if (!(schema instanceof z.ZodObject)) {
    // Non-object root: nothing to render as a form — the UI falls back to JSON.
    return { schemaId, fields: [], hasExpertiseField: false };
  }

  const shape = schema.shape;
  const fields = Object.entries(shape)
    .filter(([name]) => name !== EXPERTISE_FIELD)
    .map(([name, zodField]) => describeField(name, zodField));

  return {
    schemaId,
    fields,
    hasExpertiseField: EXPERTISE_FIELD in shape,
  };
}

module.exports = { describeSchema, describeField };
