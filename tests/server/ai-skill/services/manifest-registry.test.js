'use strict';

const {
  filterMatchesExpertise,
} = require('../../../../packages/server/ai-skill/services/manifest-registry');
const {
  validateExpertiseFilters,
} = require('../../../../scripts/check-skill-usage');

describe('manifest-registry.filterMatchesExpertise', () => {
  const ctaRedactionPromo = {
    scope: 'cta',
    categories: ['redaction'],
    emailType: 'promo',
  };

  it('matches an expertise on scope ∩ + category, ignoring emailType when expertise loads all', () => {
    expect(
      filterMatchesExpertise(ctaRedactionPromo, {
        category: 'redaction',
        scope: ['cta'],
        isTransversal: false,
        appliesToEmailTypes: [],
      })
    ).toBe(true);
  });

  it('does NOT match when the category differs (qc.cta.* must not pollute redaction)', () => {
    expect(
      filterMatchesExpertise(ctaRedactionPromo, {
        category: 'qc',
        scope: ['cta'],
        isTransversal: false,
        appliesToEmailTypes: [],
      })
    ).toBe(false);
  });

  it('does NOT match an unrelated scope', () => {
    expect(
      filterMatchesExpertise(ctaRedactionPromo, {
        category: 'redaction',
        scope: ['subject'],
        isTransversal: false,
        appliesToEmailTypes: [],
      })
    ).toBe(false);
  });

  it('matches a transversal expertise regardless of scope (same category)', () => {
    expect(
      filterMatchesExpertise(ctaRedactionPromo, {
        category: 'redaction',
        scope: [],
        isTransversal: true,
        appliesToEmailTypes: [],
      })
    ).toBe(true);
  });

  it('respects the expertise emailType restriction when the filter has an emailType', () => {
    expect(
      filterMatchesExpertise(ctaRedactionPromo, {
        category: 'redaction',
        scope: ['cta'],
        isTransversal: false,
        appliesToEmailTypes: ['newsletter'],
      })
    ).toBe(false);
  });
});

describe('check-skill-usage.validateExpertiseFilters', () => {
  it('accepts an absent field', () => {
    expect(validateExpertiseFilters('f', {})).toEqual([]);
  });

  it('accepts a well-formed filter', () => {
    expect(
      validateExpertiseFilters('f', {
        expertiseFilters: [
          { scope: 'cta', categories: ['redaction'], emailType: 'promo' },
        ],
      })
    ).toEqual([]);
  });

  it('rejects a filter missing categories', () => {
    const errors = validateExpertiseFilters('f', {
      expertiseFilters: [{ scope: 'cta' }],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/categories must be a non-empty array/);
  });

  it('rejects a filter with an empty scope', () => {
    const errors = validateExpertiseFilters('f', {
      expertiseFilters: [{ scope: [], categories: ['redaction'] }],
    });
    expect(errors[0]).toMatch(/scope must be a non-empty/);
  });
});
