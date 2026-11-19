'use strict';

// The changes of audience the back office confirms first (ADR 0013): a task
// skill opened to every company, with the expertises chosen to open with it,
// and an expertise kept to the platform company again.

const {
  opensToAll,
  closesToPlatform,
  toggled,
  openingPayload,
} = require('../../../packages/ui/helpers/ai-skill-audience-change');

describe('opensToAll', () => {
  it.each([
    ['platform', 'all', true],
    [undefined, 'all', true],
    ['all', 'all', false],
    ['platform', 'platform', false],
    ['all', 'platform', false],
  ])('from %s to %s: %s', (saved, chosen, expected) => {
    expect(opensToAll(saved, chosen)).toBe(expected);
  });
});

describe('closesToPlatform', () => {
  it.each([
    ['all', 'platform', true],
    ['all', undefined, true],
    ['platform', 'platform', false],
    [undefined, 'platform', false],
    ['platform', 'all', false],
  ])('from %s to %s: %s', (saved, chosen, expected) => {
    expect(closesToPlatform(saved, chosen)).toBe(expected);
  });
});

describe('toggled', () => {
  it('checks an expertise once', () => {
    expect(toggled(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
  });

  it('unchecks an expertise', () => {
    expect(toggled(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(toggled(undefined, 'a', false)).toEqual([]);
  });
});

describe('openingPayload', () => {
  const offered = [{ expertiseId: 'qc.proving' }, { expertiseId: 'qc.tone' }];

  it('sends nothing of the audience unless the item opens to all', () => {
    expect(openingPayload(false, ['qc.proving'], offered)).toEqual({});
  });

  it('opens the item alone when no expertise is checked', () => {
    expect(openingPayload(true, [], offered)).toEqual({ openToAll: true });
  });

  it('opens the expertises checked with it, among those offered only', () => {
    expect(openingPayload(true, ['qc.tone', 'qc.elsewhere'], offered)).toEqual({
      openToAll: true,
      openExpertiseIds: ['qc.tone'],
    });
  });
});
