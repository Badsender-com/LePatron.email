'use strict';

const {
  latestDraft,
} = require('../../../packages/ui/helpers/ai-skill-versions');

const version = (versionMajor, versionMinor, status) => ({
  versionMajor,
  versionMinor,
  status,
});

describe('latestDraft', () => {
  it('is the draft of the highest major, then minor, whatever the stored order', () => {
    const versions = [
      version(1, 0, 'ARCHIVED'),
      version(3, 0, 'DRAFT'),
      version(2, 0, 'ACTIVE'),
      version(3, 1, 'DRAFT'),
      version(2, 1, 'DRAFT'),
    ];

    expect(latestDraft(versions)).toEqual(version(3, 1, 'DRAFT'));
  });

  it('is never a version that is not a draft', () => {
    const versions = [version(1, 0, 'DRAFT'), version(2, 0, 'ACTIVE')];

    expect(latestDraft(versions)).toEqual(version(1, 0, 'DRAFT'));
  });

  it.each([
    ['no draft', [version(1, 0, 'ACTIVE')]],
    ['no version', []],
    ['nothing', undefined],
  ])('is none when there is %s', (_case, versions) => {
    expect(latestDraft(versions)).toBeNull();
  });
});
