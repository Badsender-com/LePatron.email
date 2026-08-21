'use strict';

// The project has no @vue/test-utils, so anything left inside a .vue file is
// untested. These are the decisions worth pinning, extracted for that reason:
// which message a failed request produces, whether it belongs next to a field,
// which canonical values have a translation, and what the form actually sends.

import {
  taxonomyErrorFor,
  emailMetadataErrorKeyFor,
  canonicalTypeLabelKey,
  nextOrder,
  buildTaxonomyPayload,
  CANONICAL_TYPES,
  TAXONOMY_LIMITS,
} from '../../../packages/ui/helpers/taxonomy.js';

const axiosError = (message, details) => ({
  response: { data: { message, ...(details ? { details } : {}) } },
});

describe('taxonomyErrorFor', () => {
  it('sends a duplicate label to the label field, not to a snackbar', () => {
    const result = taxonomyErrorFor(
      axiosError('TAXONOMY_ITEM_LABEL_ALREADY_EXISTS')
    );

    expect(result.key).toBe('taxonomy.errors.labelAlreadyExists');
    expect(result.field).toBe('label');
  });

  it('carries the usage count, which is what makes the refusal actionable', () => {
    const result = taxonomyErrorFor(
      axiosError('TAXONOMY_ITEM_IN_USE', { usageCount: 12 })
    );

    expect(result.key).toBe('taxonomy.errors.inUse');
    expect(result.count).toBe(12);
    expect(result.params).toEqual({ count: 12 });
    // Not a field error: the row is in the table, not in a form.
    expect(result.field).toBeNull();
  });

  it('defaults the count to 0 rather than undefined, so $tc still works', () => {
    expect(taxonomyErrorFor(axiosError('TAXONOMY_ITEM_IN_USE')).count).toBe(0);
  });

  it.each([
    ['TAXONOMY_LIMIT_REACHED', 'taxonomy.errors.limitReached'],
    ['EMAIL_METADATA_DISABLED', 'taxonomy.errors.featureDisabled'],
  ])('maps %s onto its own message', (code, key) => {
    expect(taxonomyErrorFor(axiosError(code)).key).toBe(key);
  });

  it.each([
    [axiosError('SOMETHING_NEW')],
    [axiosError(undefined)],
    [{ response: {} }],
    [{}],
    [undefined],
  ])('falls back on the generic message for %p', (error) => {
    const result = taxonomyErrorFor(error);
    expect(result.key).toBe('global.errors.errorOccured');
    expect(result.field).toBeNull();
    expect(result.count).toBeNull();
  });

  it('never returns a raw server message, only i18n keys', () => {
    const result = taxonomyErrorFor(
      axiosError('emailMetadata.requiredFields[0] is not a known field')
    );
    expect(result.key).toBe('global.errors.errorOccured');
  });
});

describe('emailMetadataErrorKeyFor', () => {
  it('distinguishes a refused payload from a failed save', () => {
    expect(emailMetadataErrorKeyFor(axiosError('INVALID_EMAIL_METADATA'))).toBe(
      'emailBuilderSettings.snackbars.invalid'
    );
    expect(emailMetadataErrorKeyFor(axiosError('SOMETHING_ELSE'))).toBe(
      'emailBuilderSettings.snackbars.error'
    );
  });

  it.each([[{}], [undefined], [{ response: {} }]])(
    'falls back for %p',
    (error) => {
      expect(emailMetadataErrorKeyFor(error)).toBe(
        'emailBuilderSettings.snackbars.error'
      );
    }
  );
});

describe('canonicalTypeLabelKey', () => {
  it.each(CANONICAL_TYPES)('translates the known value %s', (value) => {
    expect(canonicalTypeLabelKey(value)).toBe(
      `taxonomy.canonicalTypes.${value}`
    );
  });

  // The server accepts any string here on purpose, so an unknown value must not
  // surface as `taxonomy.canonicalTypes.lifecycle` in front of a user.
  it.each([
    ['lifecycle'],
    ['PROMO'],
    ['../../global.delete'],
    [''],
    [null],
    [undefined],
  ])('returns null for the unknown value %p', (value) => {
    expect(canonicalTypeLabelKey(value)).toBeNull();
  });
});

describe('nextOrder', () => {
  it('starts at 0 on an empty list', () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder()).toBe(0);
  });

  it('places a new item after the last one', () => {
    expect(nextOrder([{ order: 0 }, { order: 3 }, { order: 1 }])).toBe(4);
  });

  it('ignores items with no usable order', () => {
    expect(
      nextOrder([{ order: 2 }, {}, { order: null }, { order: 'x' }, null])
    ).toBe(3);
  });

  it('handles negative orders', () => {
    expect(nextOrder([{ order: -5 }, { order: -2 }])).toBe(-1);
  });
});

describe('buildTaxonomyPayload', () => {
  it('trims the label', () => {
    expect(buildTaxonomyPayload({ label: '  Infolettre  ' }).label).toBe(
      'Infolettre'
    );
  });

  it('sends null rather than an empty string on the optional text fields', () => {
    const payload = buildTaxonomyPayload({
      label: 'X',
      description: '',
      canonicalType: '',
    });

    expect(payload.description).toBeNull();
    expect(payload.canonicalType).toBeNull();
  });

  it('keeps the values it is given', () => {
    const payload = buildTaxonomyPayload({
      label: 'X',
      description: 'Une définition',
      canonicalType: 'promo',
      isActive: false,
      order: 3,
    });

    expect(payload).toEqual({
      label: 'X',
      description: 'Une définition',
      canonicalType: 'promo',
      isActive: false,
      order: 3,
    });
  });

  it('sends a number for the order, which arrives as a string from the input', () => {
    expect(buildTaxonomyPayload({ label: 'X', order: '7' }).order).toBe(7);
    expect(buildTaxonomyPayload({ label: 'X', order: '' }).order).toBe(0);
    expect(buildTaxonomyPayload({ label: 'X', order: 'abc' }).order).toBe(0);
  });

  it('defaults isActive to true, the state a new typology is created in', () => {
    expect(buildTaxonomyPayload({ label: 'X' }).isActive).toBe(true);
  });
});

describe('TAXONOMY_LIMITS', () => {
  // Mirrors TaxonomyLimits in packages/server/constant/taxonomy-type.js. If the
  // two drift, the form lets the user type something the server refuses.
  it('matches the server-side bounds', () => {
    expect(TAXONOMY_LIMITS).toEqual({
      LABEL: 120,
      DESCRIPTION: 2000,
      CANONICAL_TYPE: 60,
    });
  });
});
