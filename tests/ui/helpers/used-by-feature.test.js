'use strict';

// "Used by a feature" in the back office (ADR 0019, #1428): the badge of a
// row and its words in both languages. The server filters the lists. The project
// has no @vue/test-utils: the rules live in this helper, the lists read them.

const fs = require('fs');
const path = require('path');

const { usedByOf, isUsedByFeature } = require('~/helpers/used-by-feature.js');

const SUBJECT = {
  featureType: 'subject_generation',
  description: 'Subject line generation',
};
const USED = { skillId: 'redaction.subject-ideas', usedBy: [SUBJECT] };
const UNUSED = { skillId: 'qc.other', usedBy: [] };
const UNKNOWN = { skillId: 'qc.older' }; // a response without the field

describe('used by a feature', () => {
  it('reads the features the server sent', () => {
    expect(usedByOf(USED)).toEqual([SUBJECT]);
    expect(usedByOf(UNKNOWN)).toEqual([]);
    expect(usedByOf(null)).toEqual([]);
  });

  it('badges a row only when a feature uses it', () => {
    expect(isUsedByFeature(USED)).toBe(true);
    expect(isUsedByFeature(UNUSED)).toBe(false);
    expect(isUsedByFeature(UNKNOWN)).toBe(false);
  });

  it.each(['en', 'fr'])('has its words in %s', (l) => {
    const locale = fs.readFileSync(
      path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
      'utf8'
    );
    const start = locale.indexOf('usedByFeature: {');
    expect(start).toBeGreaterThan(-1);
    const section = locale.slice(start, locale.indexOf('\n    },', start));
    ['badge', 'filter', 'features', 'none'].forEach((key) =>
      expect(section).toMatch(new RegExp(`\\b${key}:`))
    );
  });
});
