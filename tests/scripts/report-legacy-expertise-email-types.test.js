'use strict';

const {
  findLegacyTaggedExpertises,
  RETIRED_EMAIL_TYPES,
} = require('../../scripts/report-legacy-expertise-email-types');
const {
  EmailTypeCanonicalValues,
} = require('../../packages/server/constant/email-type-canonical.js');

// The report exists because the failure it catches is silent: an expertise tagged
// only with retired values stops loading and nothing says so. Missing one in the
// report is the error worth pinning.

describe('report-legacy-expertise-email-types.findLegacyTaggedExpertises', () => {
  it('lists an expertise carrying a retired value, and names the value', () => {
    const legacy = findLegacyTaggedExpertises([
      {
        expertiseId: 'promo.tone',
        title: 'Promo tone',
        appliesToEmailTypes: ['promo', 'transactional'],
      },
    ]);

    expect(legacy).toEqual([
      { expertiseId: 'promo.tone', title: 'Promo tone', retired: ['promo'] },
    ]);
  });

  it('leaves out an expertise on the current vocabulary, or on none', () => {
    const legacy = findLegacyTaggedExpertises([
      {
        expertiseId: 'a',
        title: 'A',
        appliesToEmailTypes: ['editorial', 'promotional'],
      },
      { expertiseId: 'b', title: 'B', appliesToEmailTypes: [] },
      { expertiseId: 'c', title: 'C' },
    ]);

    expect(legacy).toEqual([]);
  });

  it('reports every retired value an expertise carries', () => {
    const [legacy] = findLegacyTaggedExpertises([
      {
        expertiseId: 'x',
        title: 'X',
        appliesToEmailTypes: ['newsletter', 'marketing-automation'],
      },
    ]);

    expect(legacy.retired).toEqual(['newsletter', 'marketing-automation']);
  });

  // A retired value that came back into the vocabulary would be reported as
  // something to retag while being correct.
  it('retires no value of the current vocabulary', () => {
    Object.keys(RETIRED_EMAIL_TYPES).forEach((value) => {
      expect(EmailTypeCanonicalValues).not.toContain(value);
    });
  });
});
