'use strict';

// What the Sync tab of a copy shows of its follows of production (ADR 0019,
// #1425): how the last one ended, what each outcome holds, and the words of
// both, in both languages. The project has no @vue/test-utils: the rules live
// in this helper, and the tab reads them.

const fs = require('fs');
const path = require('path');

const {
  FOLLOW_OUTCOMES,
  FOLLOW_FAILURE_REASONS,
  followFailureKey,
  followLastKey,
  followOutcomes,
  followStatusColor,
} = require('~/helpers/skills-follow.js');

const LAST = {
  status: 'partial',
  created: 3,
  updated: 0,
  upToDate: 52,
  kept: 2,
  failed: 1,
};

describe("a copy's follows of production", () => {
  it('lists the outcomes the last follow holds, in a set order, the empty ones left out', () => {
    expect(followOutcomes(LAST)).toEqual([
      { outcome: 'created', count: 3 },
      { outcome: 'upToDate', count: 52 },
      { outcome: 'kept', count: 2 },
      { outcome: 'failed', count: 1 },
    ]);
    expect(followOutcomes(null)).toEqual([]);
  });

  it('colours a follow by how it ended', () => {
    expect(followStatusColor('succeeded')).toBe('success');
    expect(followStatusColor('partial')).toBe('warning');
    expect(followStatusColor('failed')).toBe('error');
  });

  it('says why a follow failed in words of its own, whatever the server wrote', () => {
    expect(followFailureKey({ reason: 'token_refused' })).toBe(
      'aiSkills.follow.reasons.token_refused'
    );
    expect(followFailureKey({ reason: 'something new' })).toBe(
      'aiSkills.follow.reasons.unreachable'
    );
    expect(followFailureKey({})).toBe('aiSkills.follow.reasons.unreachable');
  });

  it('says who followed: a person, or the night', () => {
    expect(followLastKey({ trigger: 'manual', by: 'Alice' })).toBe(
      'aiSkills.follow.last'
    );
    expect(followLastKey({ trigger: 'night', by: '' })).toBe(
      'aiSkills.follow.lastNight'
    );
  });

  it.each(['en', 'fr'])('has its words in %s', (l) => {
    const locale = fs.readFileSync(
      path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
      'utf8'
    );
    const start = locale.indexOf('follow: {');
    expect(start).toBeGreaterThan(-1);
    const section = locale.slice(start, locale.indexOf('\n    },', start));
    [
      'title',
      'now',
      'never',
      'last',
      'lastNight',
      'succeeded',
      'partial',
      'failed',
      ...FOLLOW_OUTCOMES,
      ...FOLLOW_FAILURE_REASONS,
    ].forEach((key) => expect(section).toMatch(new RegExp(`\\b${key}:`)));
  });
});
