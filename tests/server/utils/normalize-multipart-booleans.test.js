'use strict';

const {
  normalizeMultipartBooleans,
} = require('../../../packages/server/utils/normalize-multipart-booleans.js');

const FIELDS = ['htmlBlockEnabled'];

describe('normalizeMultipartBooleans', () => {
  test.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('coerces %p to %p', (input, expected) => {
    const result = normalizeMultipartBooleans(
      { htmlBlockEnabled: input },
      FIELDS
    );
    expect(result.htmlBlockEnabled).toBe(expected);
  });

  // The whole point of this helper: Mongoose would cast the *string* 'false' to
  // `true`, silently re-enabling a switch the admin just turned off.
  it('never lets the string "false" become true', () => {
    const result = normalizeMultipartBooleans(
      { htmlBlockEnabled: 'false' },
      FIELDS
    );
    expect(result.htmlBlockEnabled).not.toBe(true);
  });

  it('leaves absent fields absent so a partial update does not reset them', () => {
    const result = normalizeMultipartBooleans({ name: 'a template' }, FIELDS);
    expect('htmlBlockEnabled' in result).toBe(false);
    expect(result.name).toBe('a template');
  });

  it('does not mutate the input body', () => {
    const body = { htmlBlockEnabled: 'false' };
    normalizeMultipartBooleans(body, FIELDS);
    expect(body.htmlBlockEnabled).toBe('false');
  });

  it('leaves other fields untouched', () => {
    const result = normalizeMultipartBooleans(
      { htmlBlockEnabled: 'true', name: 'x', description: 'false' },
      FIELDS
    );
    expect(result.name).toBe('x');
    expect(result.description).toBe('false');
  });

  it('passes through a nullish body', () => {
    expect(normalizeMultipartBooleans(null, FIELDS)).toBeNull();
    expect(normalizeMultipartBooleans(undefined, FIELDS)).toBeUndefined();
  });
});
