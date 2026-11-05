'use strict';

// Who uses a skill or an expertise (ADR 0013): the platform company every
// audience, any other company only what is opened to all. The query filter and
// the check on a loaded document answer the same.

const {
  audienceFilter,
  isAvailableTo,
} = require('../../../../packages/server/ai-skill/services/audience.js');
const { matches } = require('../../../helpers/fake-mongo-query.js');

const CLIENT = { _id: 'client', isPlatform: false };
const PLATFORM = { _id: 'platform', isPlatform: true };

describe('audience', () => {
  describe.each([
    ['a client company', CLIENT, { platform: false, all: true, none: false }],
    [
      'a caller with no company',
      undefined,
      { platform: false, all: true, none: false },
    ],
    [
      'the platform company',
      PLATFORM,
      { platform: true, all: true, none: true },
    ],
  ])('for %s', (_label, group, expected) => {
    it.each([
      ['platform', 'platform'],
      ['all', 'all'],
      ['none', undefined],
    ])('uses one whose audience is %s as expected', (key, audience) => {
      const doc = { skillId: 'qc.subject', audience };

      expect(isAvailableTo(doc, group)).toBe(expected[key]);
      expect(matches(doc, audienceFilter(group))).toBe(expected[key]);
    });
  });

  it('uses nothing that does not exist', () => {
    expect(isAvailableTo(null, PLATFORM)).toBe(false);
  });
});
