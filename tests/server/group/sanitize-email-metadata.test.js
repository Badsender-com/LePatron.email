'use strict';

// The company config is submitted by the settings page, but a page is bypassable:
// the server is what guarantees the stored shape. Same contract as
// sanitizeTrackingConfig — reconstruct the object rather than trust it, and reject
// a `requiredFields` entry that is not a known field, since an unknown name would
// silently never be enforced.

const {
  sanitizeEmailMetadata,
  EMAIL_METADATA_FIELDS,
} = require('../../../packages/server/utils/sanitize-email-metadata.js');

describe('sanitizeEmailMetadata — shape', () => {
  it.each([[undefined], [null], [{}], ['a string'], [42]])(
    'returns a disabled config with no required fields for %p',
    (input) => {
      expect(sanitizeEmailMetadata(input)).toEqual({
        enabled: false,
        requiredFields: [],
      });
    }
  );

  it.each([
    [true, true],
    ['on', true],
    [1, true],
    [false, false],
    [undefined, false],
    ['', false],
    [0, false],
  ])('coerces enabled %p to %p', (enabled, expected) => {
    expect(sanitizeEmailMetadata({ enabled }).enabled).toBe(expected);
  });

  it('drops unknown keys instead of storing them', () => {
    const result = sanitizeEmailMetadata({
      enabled: true,
      requiredFields: [],
      somethingElse: 'ignored',
      __proto__polluted: true,
    });

    expect(Object.keys(result).sort()).toEqual(['enabled', 'requiredFields']);
  });
});

describe('sanitizeEmailMetadata — requiredFields', () => {
  it.each(EMAIL_METADATA_FIELDS)('accepts the known field %s', (field) => {
    expect(
      sanitizeEmailMetadata({ requiredFields: [field] }).requiredFields
    ).toEqual([field]);
  });

  it('accepts every known field at once', () => {
    const result = sanitizeEmailMetadata({
      enabled: true,
      requiredFields: [...EMAIL_METADATA_FIELDS],
    });
    expect(result.requiredFields).toEqual([...EMAIL_METADATA_FIELDS]);
  });

  it('trims the field names', () => {
    expect(
      sanitizeEmailMetadata({ requiredFields: ['  subject  '] }).requiredFields
    ).toEqual(['subject']);
  });

  it.each([['language'], ['brand'], ['SUBJECT'], ['']])(
    'refuses the unknown field %p',
    (field) => {
      expect(() => sanitizeEmailMetadata({ requiredFields: [field] })).toThrow(
        /not a known field/
      );
    }
  );

  it.each([[42], [null], [{}], [['nested']]])(
    'refuses a non-string entry (%p)',
    (field) => {
      expect(() => sanitizeEmailMetadata({ requiredFields: [field] })).toThrow(
        /must be a string/
      );
    }
  );

  it('refuses a duplicate, which would be a UI bug worth surfacing', () => {
    expect(() =>
      sanitizeEmailMetadata({ requiredFields: ['subject', 'subject'] })
    ).toThrow(/duplicate/);
  });

  it.each([['a string'], [42], [{}]])(
    'refuses a non-array requiredFields (%p)',
    (requiredFields) => {
      expect(() => sanitizeEmailMetadata({ requiredFields })).toThrow(
        /must be an array/
      );
    }
  );

  it.each([[null], [undefined]])(
    'treats %p as an empty list',
    (requiredFields) => {
      expect(sanitizeEmailMetadata({ requiredFields }).requiredFields).toEqual(
        []
      );
    }
  );

  it('carries the error code and status the API layer needs', () => {
    try {
      sanitizeEmailMetadata({ requiredFields: ['nope'] });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('INVALID_EMAIL_METADATA');
      expect(error.statusCode).toBe(422);
    }
  });
});
