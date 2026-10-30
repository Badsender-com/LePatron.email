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
const TEMPLATE_ID = '507f1f77bcf86cd799439f01';
// Templates are ids: a list of them, each a valid one.
const idsOf = (length) =>
  Array.from(
    { length },
    (_, i) => `507f1f77bcf86cd7994${String(i).padStart(5, '0')}`
  );
const LISTS = { tags: listOf, templates: idsOf };

describe('validateFiltersJSON', () => {
  it.each([[undefined], [null]])('lets %p through untouched', (filters) => {
    expect(validateFiltersJSON(filters)).toBe(filters);
  });

  it('returns the filters unchanged when they pass', () => {
    const filters = { tags: ['a', 'b'], templates: [TEMPLATE_ID] };
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
      expect(() =>
        validateFiltersJSON({ [key]: LISTS[key](MAX) })
      ).not.toThrow();
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
        validateFiltersJSON({
          templates: [TEMPLATE_ID],
          tags: listOf(MAX + 1),
        })
      ).toThrow(
        expect.objectContaining({
          message: ERROR_CODES.FILTER_TOO_MANY_VALUES,
        })
      );
    });
  });
});

// The name reaches a pattern match, the dates a Date: a number or a word there
// threw a 500 deep in the query (epic #1144 review), where it is a 400.
describe('validateFiltersJSON, name and dates', () => {
  const malformed = (filters) =>
    expect(() => validateFiltersJSON(filters)).toThrow(
      expect.objectContaining({
        status: 400,
        message: ERROR_CODES.BAD_FORMAT_FILTERS,
      })
    );

  it('takes a name, empty or not, and dates as the pickers send them', () => {
    const filters = {
      name: '',
      createdAtStart: '2026-01-01',
      createdAtEnd: '',
      updatedAtStart: '2026-10-01',
      updatedAtEnd: '2026-10-22',
    };
    expect(validateFiltersJSON(filters)).toBe(filters);
  });

  it.each([
    [5],
    [['spring']],
    [{ $regex: '.*' }],
  ])('refuses a name that is not a string: %p', (name) => malformed({ name }));

  it.each([
    ['yesterday'],
    [20261001],
    [{}],
  ])('refuses a date that is not one: %p', (date) =>
    malformed({ updatedAtStart: date })
  );
});

// The values inside the lists reach a `$in` cast against the schema: an
// object there was a cast error, a 500 (epic #1144 review).
describe('validateFiltersJSON, what the lists hold', () => {
  const refused = (filters, message = ERROR_CODES.BAD_FORMAT_FILTERS) =>
    expect(() => validateFiltersJSON(filters)).toThrow(
      expect.objectContaining({ status: 400, message })
    );

  it('refuses a tag that is not a string', () =>
    refused({ tags: ['promo', { $gt: '' }] }));

  it('refuses a template that is not an id', () =>
    refused({ templates: ['news'] }));

  it('refuses a name longer than any email name, as too long', () =>
    refused({ name: 'a'.repeat(201) }, ERROR_CODES.FILTER_TOO_LONG));

  it('takes a name of 200 characters', () => {
    expect(() => validateFiltersJSON({ name: 'a'.repeat(200) })).not.toThrow();
  });
});
