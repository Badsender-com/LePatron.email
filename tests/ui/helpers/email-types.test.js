'use strict';

const {
  EMAIL_TYPES,
  emailTypeItems,
  emailTypeLabel,
} = require('../../../packages/ui/helpers/email-types');

describe('emailTypeItems', () => {
  it('offers the canonical types on a fresh base (no facet)', () => {
    expect(emailTypeItems([])).toEqual(EMAIL_TYPES);
    expect(emailTypeItems()).toEqual(EMAIL_TYPES);
  });

  it('appends facet values that are not canonical, sorted', () => {
    expect(emailTypeItems(['relance', 'promo', 'abandon'])).toEqual([
      ...EMAIL_TYPES,
      'abandon',
      'relance',
    ]);
  });

  it('never duplicates a canonical type already present in the facets', () => {
    const items = emailTypeItems(EMAIL_TYPES);
    expect(items).toEqual(EMAIL_TYPES);
    expect(new Set(items).size).toBe(items.length);
  });

  it('dedupes and drops empty facet values', () => {
    expect(emailTypeItems(['relance', 'relance', '', null])).toEqual([
      ...EMAIL_TYPES,
      'relance',
    ]);
  });
});

describe('emailTypeLabel', () => {
  // Stands in for the component instance: mimics vue-i18n returning the key
  // itself when there is no translation for it.
  const vm = {
    $t: (key) => (key === 'aiSkills.emailTypes.promo' ? 'Promotionnel' : key),
  };

  it('translates a canonical type', () => {
    expect(emailTypeLabel(vm, 'promo')).toBe('Promotionnel');
  });

  it('falls back to the raw value for a custom type', () => {
    expect(emailTypeLabel(vm, 'relance')).toBe('relance');
  });

  it('returns an empty string for no value', () => {
    expect(emailTypeLabel(vm, null)).toBe('');
  });
});
