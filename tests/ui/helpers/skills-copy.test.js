'use strict';

// What a copy's pages read of where an item comes from (ADR 0019), and what
// they offer to do with it.

const {
  copyStateOf,
  fetchCopyState,
  copyOriginOf,
  copyActionsOf,
  duplicateChoicesOf,
  itemIdOf,
} = require('~/helpers/skills-copy.js');

const VERSIONS = [
  { versionMajor: 1, versionMinor: 0, status: 'ARCHIVED' },
  { versionMajor: 1, versionMinor: 1, status: 'ACTIVE' },
  { versionMajor: 2, versionMinor: 0, status: 'DRAFT' },
];

describe('what an instance is', () => {
  it('reads a copy, the night and the follow running now', () => {
    expect(
      copyStateOf({
        isCopy: true,
        nightly: { enabled: true },
        lock: { trigger: 'night' },
      })
    ).toEqual({
      isCopy: true,
      followedOnce: false,
      nightly: true,
      lock: { trigger: 'night' },
    });
  });

  it('takes an instance that follows a production for a copy, before the server says so', () => {
    expect(copyStateOf({ configured: true }).isCopy).toBe(true);
    expect(copyStateOf({ isCopy: false, configured: true }).isCopy).toBe(false);
  });

  it.each([
    [null, false],
    [{ status: 'failed' }, false],
    [{ status: 'partial' }, true],
    [{ status: 'succeeded' }, true],
  ])(
    'reads whether the copy has completed a follow from its last one, %j',
    (last, followedOnce) => {
      expect(copyStateOf({ isCopy: true, last }).followedOnce).toBe(
        followedOnce
      );
    }
  );

  it('takes an instance it cannot read for production', async () => {
    const $axios = { $get: jest.fn().mockRejectedValue(new Error('down')) };
    expect(await fetchCopyState($axios, () => '/ai-skills/follow')).toEqual({
      isCopy: false,
      followedOnce: false,
      nightly: false,
      lock: null,
    });
  });
});

describe('where an item of a copy comes from', () => {
  it.each([
    [{ followedAt: '2026-11-10' }, 'followed'],
    [{ followedAt: '2026-11-10', keptOnCopy: true }, 'kept'],
    [{}, 'local'],
    [{ copiedFrom: 'redaction', followedAt: '2026-11-10' }, 'copied'],
  ])('%j comes from %s', (item, origin) => {
    expect(copyOriginOf(item, true, true)).toBe(origin);
  });

  it('is not followed yet while the copy has completed no follow', () => {
    expect(copyOriginOf({}, true, false)).toBe('notFollowed');
    expect(copyOriginOf({ keptOnCopy: true }, true, false)).toBe('kept');
  });

  it('comes from nowhere on production', () => {
    expect(copyOriginOf({ followedAt: '2026-11-10' }, false)).toBeNull();
  });
});

describe('what a copy does with an item', () => {
  it.each([
    [{ followedAt: 'x', versions: VERSIONS }, true, false, true],
    [{ keptOnCopy: true, versions: VERSIONS }, false, true, true],
    [{ versions: VERSIONS }, true, false, false],
    [{ copiedFrom: 'a', versions: VERSIONS }, true, false, false],
    [
      { copiedFrom: 'a', keptOnCopy: true, versions: VERSIONS },
      false,
      true,
      false,
    ],
  ])(
    '%j: keep %s, follow %s, duplicate %s',
    (item, keep, follow, duplicate) => {
      expect(copyActionsOf(item, true)).toEqual({ keep, follow, duplicate });
    }
  );

  it('offers nothing on production', () => {
    expect(
      copyActionsOf({ followedAt: 'x', versions: VERSIONS }, false)
    ).toEqual({ keep: false, follow: false, duplicate: false });
  });

  it('duplicates the active version at first, any version on demand', () => {
    const { choices, initial } = duplicateChoicesOf({
      versions: VERSIONS,
      activeVersion: { major: 1, minor: 1 },
    });
    expect(choices.map(({ value }) => value)).toEqual(['2.0', '1.1', '1.0']);
    expect(initial).toBe('1.1');
    expect(duplicateChoicesOf({ versions: VERSIONS }).initial).toBe('2.0');
  });

  it('reads the id of a skill and of an expertise', () => {
    expect(itemIdOf('skill', { skillId: 'a' })).toBe('a');
    expect(itemIdOf('expertise', { expertiseId: 'b' })).toBe('b');
  });
});
