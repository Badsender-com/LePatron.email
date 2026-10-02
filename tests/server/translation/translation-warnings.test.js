'use strict';

// The job's warning keys are worded by the frontend: a key the server sends
// and the UI cannot word is a line the user never sees.

const en = require('../../../packages/ui/helpers/locales/en').default;
const fr = require('../../../packages/ui/helpers/locales/fr').default;
const {
  WARNING_KEYS,
  COMPOSED_BLOCK_WARNING_KEY,
  warningKeysFor,
} = require('../../../packages/server/translation/translation-warnings.js');

const wordingOf = (locale, key) =>
  key.split('.').reduce((node, part) => node && node[part], locale);

describe('translation warning keys', () => {
  test.each(
    [...WARNING_KEYS, COMPOSED_BLOCK_WARNING_KEY].flatMap((key) => [
      ['en', key],
      ['fr', key],
    ])
  )('%s words %s', (lang, key) => {
    const wording = wordingOf(lang === 'en' ? en : fr, key);
    expect(typeof wording).toBe('string');
    expect(wording.length).toBeGreaterThan(0);
  });

  it('asks for the usual checks when every composed block came out right', () => {
    expect(
      warningKeysFor(
        { composedBlocksOversized: 0, composedBlocksOutdated: 0 },
        0
      )
    ).toEqual(WARNING_KEYS);
  });

  it('says nothing of composed blocks for a mailing without any', () => {
    expect(warningKeysFor({}, 0)).toEqual(WARNING_KEYS);
  });

  test.each([
    ['one too large once rebuilt', { composedBlocksOversized: 1 }, 0],
    ['one written by another generator', { composedBlocksOutdated: 1 }, 0],
    ['one the preview could not place', {}, 1],
  ])('warns about composed blocks for %s', (_label, stats, missed) => {
    expect(warningKeysFor(stats, missed)).toEqual([
      ...WARNING_KEYS,
      COMPOSED_BLOCK_WARNING_KEY,
    ]);
  });
});
