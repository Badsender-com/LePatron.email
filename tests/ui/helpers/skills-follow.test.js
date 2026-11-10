'use strict';

// What the "Production and copies" tab of a copy shows of its follows of
// production (ADR 0019, #1425): how the last one ended, what each outcome
// holds, what the report says item by item, and the words of all of it, in
// both languages. The rules live in this helper, and the tab reads them.

const fs = require('fs');
const path = require('path');

const {
  FOLLOW_OUTCOMES,
  FOLLOW_FAILURE_REASONS,
  followDetails,
  followDoneNotice,
  followFailureKey,
  followItemErrorKey,
  followLastKey,
  followLockKey,
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

  it('counts the items of a report as the counts of the last follow', () => {
    expect(
      followOutcomes({
        created: [{ id: 'a' }],
        moved: [{ id: 'b' }, { id: 'c' }],
        removed: [{ id: 'd' }],
        kept: [],
      })
    ).toEqual([
      { outcome: 'created', count: 1 },
      { outcome: 'moved', count: 2 },
      { outcome: 'removed', count: 1 },
    ]);
  });

  it('says a follow that failed for some items in its own words and color', () => {
    expect(followDoneNotice('succeeded')).toEqual({
      key: 'aiSkills.follow.done',
      color: 'success',
    });
    expect(followDoneNotice('partial')).toEqual({
      key: 'aiSkills.follow.donePartial',
      color: 'warning',
    });
  });

  it('reads a failed item by its code, never by the sentence of the server', () => {
    expect(
      followItemErrorKey({ id: 'a', message: 'SKILLS_FOLLOW_CONFLICT' })
    ).toBe('aiSkills.errors.SKILLS_FOLLOW_CONFLICT');
    expect(followItemErrorKey({ id: 'a', code: 'X' })).toBe(
      'aiSkills.errors.X'
    );
    expect(followItemErrorKey({ id: 'a' })).toBeNull();
  });

  it('says who holds the follow running now', () => {
    expect(followLockKey({ trigger: 'manual', by: 'Alice' })).toBe(
      'aiSkills.follow.lock'
    );
    expect(followLockKey({ trigger: 'night' })).toBe(
      'aiSkills.follow.lockNight'
    );
  });

  it('names, item by item, the work moved, the kept items production changed, the removed ones and the warnings', () => {
    const details = followDetails({
      created: [
        {
          kind: 'skill',
          id: 'qc.review',
          warnings: [{ code: 'missing_expertises', expertiseIds: ['tone'] }],
        },
      ],
      moved: [{ kind: 'skill', id: 'redaction', copyId: 'redaction.copie' }],
      removed: [{ kind: 'expertise', id: 'old' }],
      kept: [
        {
          kind: 'expertise',
          id: 'brand',
          reason: 'kept_on_copy',
          productionChanged: true,
        },
        {
          kind: 'skill',
          id: 'same',
          reason: 'kept_on_copy',
          productionChanged: false,
        },
        { kind: 'skill', id: 'local', reason: 'local_only' },
      ],
    });

    expect(details.moved).toEqual([
      {
        kind: 'skill',
        id: 'redaction',
        copyId: 'redaction.copie',
        to: '/ai-skills/redaction.copie',
      },
    ]);
    expect(details.removed).toEqual([{ kind: 'expertise', id: 'old' }]);
    expect(details.kept).toEqual([
      { kind: 'expertise', id: 'brand', to: '/ai-expertise/brand' },
    ]);
    expect(details.warnings).toEqual([
      {
        code: 'missing_expertises',
        expertiseIds: ['tone'],
        kind: 'skill',
        id: 'qc.review',
        to: '/ai-skills/qc.review',
      },
    ]);
  });

  it('names nothing when the last follow holds only counts', () => {
    expect(followDetails({ created: 3, moved: 1 })).toEqual({
      moved: [],
      removed: [],
      kept: [],
      warnings: [],
    });
    expect(followDetails(null).moved).toEqual([]);
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
      'nightlyOn',
      'nightlyOff',
      'lock',
      'lockNight',
      'alreadyRunning',
      'donePartial',
      'partialHint',
      'itemFailed',
      'movedLabel',
      'keptLabel',
      'productionChanged',
      'removedLabel',
      'missing_expertises',
      'succeeded',
      'partial',
      'failed',
      ...FOLLOW_OUTCOMES,
      ...FOLLOW_FAILURE_REASONS,
    ].forEach((key) => expect(section).toMatch(new RegExp(`\\b${key}:`)));
  });
});
