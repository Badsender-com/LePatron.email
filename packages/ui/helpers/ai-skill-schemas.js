// A feature skill may be born on production before its code (ADR 0019): a
// draft names an input or output schema that the code of this instance does
// not have yet. It is saved with a warning and keeps a badge; its
// publication waits for the code. The rules the pages read, tested on their
// own.

import { SKILL_NATURES } from '~/helpers/ai-skill-categories.js';

// The warning a save of such a draft says, as the server's warnings are said.
export const SCHEMA_NOT_IN_CODE = 'SCHEMA_NOT_IN_CODE';

/**
 * The schemas a version names that this instance's code does not have.
 *
 * @param {Object} version a skill's version, or its draft on screen
 * @param {string[]} schemas the schema ids of this instance's code; none
 *   read, nothing is said missing
 * @returns {string[]}
 */
export function missingSchemaIds(version, schemas) {
  if (!version || version.nature === SKILL_NATURES.TASK) return [];
  if (!schemas || !schemas.length) return [];
  const known = new Set(schemas);
  return [version.inputSchemaId, version.outputSchemaId].filter(
    (id) => id && !known.has(id)
  );
}

/**
 * The warnings of a save, with one for each schema the version names that
 * the code lacks, said once even when the server says it too.
 *
 * @param {Object[]} warnings what the server answered
 * @returns {Object[]}
 */
export function withMissingSchemaWarnings(warnings, version, schemas) {
  const said = new Set(
    (warnings || [])
      .filter((warning) => warning && warning.code === SCHEMA_NOT_IN_CODE)
      .map((warning) => warning.schemaId)
  );
  return [
    ...(warnings || []),
    ...missingSchemaIds(version, schemas)
      .filter((schemaId) => !said.has(schemaId))
      .map((schemaId) => ({ code: SCHEMA_NOT_IN_CODE, schemaId })),
  ];
}
