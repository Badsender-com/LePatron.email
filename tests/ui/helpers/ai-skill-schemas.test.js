'use strict';

// A feature skill born on production before its code (ADR 0019): a draft
// naming a schema the code of this instance lacks is said so, once.

const {
  SCHEMA_NOT_IN_CODE,
  missingSchemaIds,
  withMissingSchemaWarnings,
} = require('~/helpers/ai-skill-schemas.js');

const SCHEMAS = ['subjectInput', 'subjectOutput'];

describe('a schema the code of this instance lacks', () => {
  it('is found in the input or the output of a feature version', () => {
    expect(
      missingSchemaIds(
        { inputSchemaId: 'newInput', outputSchemaId: 'subjectOutput' },
        SCHEMAS
      )
    ).toEqual(['newInput']);
    expect(
      missingSchemaIds(
        { inputSchemaId: 'subjectInput', outputSchemaId: 'newOutput' },
        SCHEMAS
      )
    ).toEqual(['newOutput']);
  });

  it('is never found in a task version, an empty field, or schemas not read', () => {
    expect(
      missingSchemaIds({ nature: 'task', inputSchemaId: 'newInput' }, SCHEMAS)
    ).toEqual([]);
    expect(missingSchemaIds({ inputSchemaId: '' }, SCHEMAS)).toEqual([]);
    expect(missingSchemaIds({ inputSchemaId: 'newInput' }, [])).toEqual([]);
    expect(missingSchemaIds(null, SCHEMAS)).toEqual([]);
  });

  it('adds a warning to those of a save, said once when the server says it too', () => {
    const version = { inputSchemaId: 'newInput', outputSchemaId: 'newOutput' };
    expect(
      withMissingSchemaWarnings(
        [
          { code: 'TEMPLATE_MISSING_EXPERTISE' },
          { code: SCHEMA_NOT_IN_CODE, schemaId: 'newInput' },
        ],
        version,
        SCHEMAS
      )
    ).toEqual([
      { code: 'TEMPLATE_MISSING_EXPERTISE' },
      { code: SCHEMA_NOT_IN_CODE, schemaId: 'newInput' },
      { code: SCHEMA_NOT_IN_CODE, schemaId: 'newOutput' },
    ]);
    expect(withMissingSchemaWarnings(undefined, {}, SCHEMAS)).toEqual([]);
  });
});
