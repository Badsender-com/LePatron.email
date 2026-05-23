'use strict';

const {
  schemas,
  getSchema,
  listSchemaIds,
  hasSchema,
} = require('../../../../packages/server/ai-skill/schemas');

describe('zod schema registry', () => {
  it('exposes the demo schemas', () => {
    expect(hasSchema('genericTextInput')).toBe(true);
    expect(hasSchema('genericTextOutput')).toBe(true);
  });

  it('returns undefined for unknown schemaId', () => {
    expect(getSchema('does-not-exist')).toBeUndefined();
    expect(hasSchema('does-not-exist')).toBe(false);
  });

  it('lists known schemaIds', () => {
    const ids = listSchemaIds();
    expect(ids).toContain('genericTextInput');
    expect(ids).toContain('genericTextOutput');
  });

  it('genericTextInput validates a valid payload', () => {
    const result = schemas.genericTextInput.safeParse({ prompt: 'hi' });
    expect(result.success).toBe(true);
  });

  it('genericTextInput rejects missing prompt', () => {
    const result = schemas.genericTextInput.safeParse({ context: 'x' });
    expect(result.success).toBe(false);
  });

  it('genericTextOutput is strict (extra keys rejected)', () => {
    const result = schemas.genericTextOutput.safeParse({
      text: 'ok',
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});
