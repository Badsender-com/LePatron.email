'use strict';

const {
  hasFilterScope,
  hasFilterCategories,
  needsCategoryDefault,
  serialiseExpertiseFilter,
  inferExpertiseMode,
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

describe('needsCategoryDefault (both input orders) — filter category pre-fill', () => {
  it('only defaults in filter mode', () => {
    expect(needsCategoryDefault('none', 'qc', {})).toBe(false);
    expect(needsCategoryDefault('explicit', 'qc', {})).toBe(false);
    expect(needsCategoryDefault('filter', 'qc', {})).toBe(true);
  });

  it('skill→mode: category known before switching to filter → default needed', () => {
    // Skill already chosen (category qc), user switches to filter, no category.
    expect(needsCategoryDefault('filter', 'qc', { scope: ['subject'] })).toBe(
      true
    );
  });

  it('mode→skill: filter first, category resolves later → default needed then', () => {
    expect(needsCategoryDefault('filter', null, {})).toBe(false); // skill not chosen yet
    expect(needsCategoryDefault('filter', 'qc', {})).toBe(true); // category arrives
  });

  it('does not override a category the user already set', () => {
    expect(
      needsCategoryDefault('filter', 'qc', { categories: ['redaction'] })
    ).toBe(false);
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

// Which mode an existing scenario reloads in. Four implementations of this
// predicate disagreed; the one on the page ignored `categories`, so a
// filter-on-categories scenario came back as 'none' and the next save erased
// the filter.
describe('inferExpertiseMode', () => {
  it('is explicit as soon as there is one reference', () => {
    expect(
      inferExpertiseMode({
        expertiseRefs: [{ expertiseId: 'e1' }],
        expertiseFilter: { scope: ['cta'], categories: ['qc'] },
      })
    ).toBe('explicit');
  });

  it('is filter for a scope-only filter', () => {
    expect(
      inferExpertiseMode({
        expertiseRefs: [],
        expertiseFilter: { scope: ['cta'] },
      })
    ).toBe('filter');
  });

  it('is filter for a categories-only filter — the case that used to be lost', () => {
    expect(
      inferExpertiseMode({
        expertiseRefs: [],
        expertiseFilter: { scope: [], categories: ['redaction'] },
      })
    ).toBe('filter');
  });

  it('is filter for an emailType-only or language-only filter', () => {
    expect(
      inferExpertiseMode({ expertiseFilter: { emailType: 'promo' } })
    ).toBe('filter');
    expect(inferExpertiseMode({ expertiseFilter: { language: 'fr' } })).toBe(
      'filter'
    );
  });

  it('is none for an empty scenario, an empty filter, or no argument', () => {
    expect(inferExpertiseMode({})).toBe('none');
    expect(
      inferExpertiseMode({
        expertiseRefs: [],
        expertiseFilter: {
          scope: [],
          categories: [],
          emailType: null,
          language: null,
        },
      })
    ).toBe('none');
    expect(inferExpertiseMode()).toBe('none');
  });
});
