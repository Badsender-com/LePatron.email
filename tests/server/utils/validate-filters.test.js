'use strict';

// The listing filters come from a JSON query-string parameter, so nothing about
// their shape is guaranteed. Two things are checked here, and they are NOT the
// same failure: a value that is not an array is malformed, a value that is an
// array of 340 entries is well formed but too long. They carry different error
// codes so the front can tell the user what to do about it.
//
// The size cap exists at all because an unbounded `$in` is a cheap way to make
// MongoDB do a lot of work. Pinned by a test so it cannot be raised, lowered or
// dropped without a deliberate decision — an untested limit is not a limit.

const {
  validateFiltersJSON,
} = require('../../../packages/server/utils/model.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const MAX = 200;
const listOf = (length) => Array.from({ length }, (_, i) => `tag-${i}`);

describe('validateFiltersJSON', () => {
  it.each([[undefined], [null]])('lets %p through untouched', (filters) => {
    expect(validateFiltersJSON(filters)).toBe(filters);
  });

  it('returns the filters unchanged when they pass', () => {
    const filters = { tags: ['a', 'b'], templates: ['t'] };
    expect(validateFiltersJSON(filters)).toBe(filters);
  });

  it.each([['tags'], ['templates']])(
    'ignores an absent %s rather than rejecting it',
    (key) => {
      expect(() => validateFiltersJSON({ [key]: null })).not.toThrow();
      expect(() => validateFiltersJSON({})).not.toThrow();
    }
  );

  describe('shape', () => {
    it.each([['tags'], ['templates']])(
      'refuses a %s that is not an array',
      (key) => {
        expect(() => validateFiltersJSON({ [key]: 'a-single-tag' })).toThrow(
          expect.objectContaining({
            status: 400,
            message: ERROR_CODES.BAD_FORMAT_FILTERS,
          })
        );
      }
    );

    it('says which filter is malformed', () => {
      expect(() => validateFiltersJSON({ tags: {} })).toThrow(
        expect.objectContaining({ details: 'tags must be an array' })
      );
    });
  });

  describe('size', () => {
    it.each([['tags'], ['templates']])('accepts %s at the cap', (key) => {
      expect(() => validateFiltersJSON({ [key]: listOf(MAX) })).not.toThrow();
    });

    it.each([['tags'], ['templates']])('refuses %s one over the cap', (key) => {
      expect(() => validateFiltersJSON({ [key]: listOf(MAX + 1) })).toThrow(
        expect.objectContaining({
          status: 400,
          // NOT BAD_FORMAT_FILTERS: the list is well formed, only too long.
          message: ERROR_CODES.FILTER_TOO_MANY_VALUES,
        })
      );
    });

    // What turns a support ticket into a log read: the count received and the
    // limit, so nobody goes looking for a malformation that is not there.
    it('reports the count received and the maximum', () => {
      expect(() => validateFiltersJSON({ tags: listOf(340) })).toThrow(
        expect.objectContaining({
          details: `tags: 340 entries, maximum is ${MAX}`,
        })
      );
    });

    it('checks every declared filter, not just the first', () => {
      expect(() =>
        validateFiltersJSON({ templates: ['ok'], tags: listOf(MAX + 1) })
      ).toThrow(
        expect.objectContaining({
          message: ERROR_CODES.FILTER_TOO_MANY_VALUES,
        })
      );
    });
  });
});
