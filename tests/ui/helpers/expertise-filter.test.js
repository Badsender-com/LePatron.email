'use strict';

const {
  hasFilterScope,
  hasFilterCategories,
  serialiseExpertiseFilter,
} = require('../../../packages/ui/helpers/expertise-filter');

describe('hasFilterScope', () => {
  it('is true only for a non-empty scope array', () => {
    expect(hasFilterScope({ scope: ['cta'] })).toBe(true);
    expect(hasFilterScope({ scope: [] })).toBe(false);
    expect(hasFilterScope({})).toBe(false);
    expect(hasFilterScope(null)).toBe(false);
  });
});

describe('hasFilterCategories', () => {
  it('is true only for a non-empty categories array', () => {
    expect(hasFilterCategories({ categories: ['redaction'] })).toBe(true);
    expect(hasFilterCategories({ categories: [] })).toBe(false);
    expect(hasFilterCategories({})).toBe(false);
    expect(hasFilterCategories(null)).toBe(false);
  });
});

describe('preview gating (scope AND categories) — §1', () => {
  // The preview is called only when both guards pass; the serialised params
  // then carry scope AND categories.
  const canPreview = (f) => hasFilterScope(f) && hasFilterCategories(f);

  it('does not preview with a scope but no categories', () => {
    expect(canPreview({ scope: ['cta'], categories: [] })).toBe(false);
  });

  it('previews and sends scope + categories when both are set', () => {
    const filter = { scope: ['cta'], categories: ['redaction'] };
    expect(canPreview(filter)).toBe(true);
    expect(serialiseExpertiseFilter(filter)).toEqual({
      scope: ['cta'],
      categories: ['redaction'],
    });
  });
});

describe('serialiseExpertiseFilter', () => {
  it('maps every criterion to a query param (preview wiring)', () => {
    expect(
      serialiseExpertiseFilter({
        scope: ['cta', 'subject'],
        categories: ['redaction'],
        emailType: 'promo',
        language: 'fr',
      })
    ).toEqual({
      scope: ['cta', 'subject'],
      categories: ['redaction'],
      emailType: 'promo',
      language: 'fr',
    });
  });

  it('omits empty criteria so they do not over-constrain the count', () => {
    expect(
      serialiseExpertiseFilter({
        scope: ['cta'],
        categories: [],
        emailType: null,
        language: '',
      })
    ).toEqual({ scope: ['cta'] });
  });

  it('returns an empty object for an empty filter', () => {
    expect(serialiseExpertiseFilter({})).toEqual({});
    expect(serialiseExpertiseFilter(null)).toEqual({});
  });
});
