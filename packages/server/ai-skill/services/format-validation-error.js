'use strict';

/**
 * Turn a zod input-validation error into structured, UI-consumable field
 * errors. Presentation layer only: the zod schemas stay the source of truth,
 * this just reshapes their issues so the playground can show human messages
 * inline under the right form field.
 *
 * Issue mapping (verified against the installed zod 4.4.3):
 *   - invalid_type + the submitted value at `path` is undefined → 'required'
 *     (zod 4 issues carry no `received` property — testing the input is the
 *     reliable, locale-proof way; never parse the message text)
 *   - unrecognized_keys → one 'unrecognized' entry PER key of `issue.keys`
 *   - too_small / too_big → 'length'
 *   - anything else (wrong type with a value present, invalid_value…) → 'invalid'
 */

function getAtPath(input, path) {
  let value = input;
  for (const segment of path || []) {
    if (value == null) return undefined;
    value = value[segment];
  }
  return value;
}

/**
 * @param {import('zod').ZodError} zodError
 * @param {Object} input — the raw input that was submitted to safeParse
 * @returns {Array<{field: string, issue: 'required'|'unrecognized'|'length'|'invalid'}>}
 */
function buildFieldErrors(zodError, input) {
  const entries = [];

  for (const issue of zodError.issues || []) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys || []) {
        entries.push({
          field: [...(issue.path || []), key].join('.'),
          issue: 'unrecognized',
        });
      }
      continue;
    }

    const field = (issue.path || []).join('.') || '<root>';
    let kind = 'invalid';
    if (
      issue.code === 'invalid_type' &&
      getAtPath(input, issue.path) === undefined
    ) {
      kind = 'required';
    } else if (issue.code === 'too_small' || issue.code === 'too_big') {
      kind = 'length';
    }
    entries.push({ field, issue: kind });
  }

  // One error per field: keep the first (zod reports required before the rest).
  const seen = new Set();
  return entries.filter((e) => {
    if (seen.has(e.field)) return false;
    seen.add(e.field);
    return true;
  });
}

module.exports = { buildFieldErrors };
