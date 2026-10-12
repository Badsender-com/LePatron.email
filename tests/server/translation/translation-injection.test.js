'use strict';

// Writing a mailing's translations back, generic and composed-block keys
// together.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const {
  injectTranslations,
} = require('../../../packages/server/translation/translation-injection.js');

describe('the dropped composed-block keys, as logged', () => {
  beforeEach(() => jest.clearAllMocks());

  // They come back from the provider: neither their number nor their length
  // is ours to bound, so the log line must not grow with them.
  it('names a few, cut short, and counts the rest', async () => {
    const translations = {};
    for (let i = 0; i < 20; i++) {
      translations[`builderBlock.ghost${'x'.repeat(200)}.${i}.0.content`] =
        'Hello';
    }

    await injectTranslations({ name: 'n', data: {} }, translations);

    const line = logger.warn.mock.calls
      .map(([message]) => message)
      .find((message) => message.includes('dropped'));
    expect(line).toContain('20 composed-block key(s) dropped');
    expect(line).toContain('(+15 more)');
    expect(line.length).toBeLessThan(600);
  });

  it('lists every key when there are only a few', async () => {
    await injectTranslations(
      { name: 'n', data: {} },
      { 'builderBlock.ghost.0.0.content': 'Hello' }
    );

    expect(logger.warn).toHaveBeenCalledWith(
      '[Translation] 1 composed-block key(s) dropped: builderBlock.ghost.0.0.content'
    );
  });
});
