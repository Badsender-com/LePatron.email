'use strict';

const {
  hasFilterScope,
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
