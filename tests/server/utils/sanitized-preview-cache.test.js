'use strict';

// One cache per sanitizer, keyed on the mailing and its last write, bounded by
// the characters it holds. `peek` answers from `_id` and `updatedAt` alone, so
// that a caller can skip reading the HTML from the database on a hit.

const {
  createSanitizedPreviewCache,
} = require('../../../packages/server/utils/sanitized-preview-cache.js');

const version = (id, day, html) => ({
  _id: id,
  updatedAt: new Date(`2026-09-${day}`),
  previewHtml: html,
});

function makeCache(options = {}) {
  const sanitize = jest.fn((html) => `clean:${html}`);
  return {
    sanitize,
    cache: createSanitizedPreviewCache({ sanitize, ...options }),
  };
}

describe('createSanitizedPreviewCache', () => {
  it('sanitizes a version once, then answers from memory without the HTML', () => {
    const { sanitize, cache } = makeCache();
    expect(cache.peek(version('m1', '01'))).toBeUndefined();
    expect(cache.sanitizeCached(version('m1', '01', '<p>a</p>'))).toBe(
      'clean:<p>a</p>'
    );
    expect(cache.peek({ _id: 'm1', updatedAt: new Date('2026-09-01') })).toBe(
      'clean:<p>a</p>'
    );
    expect(sanitize).toHaveBeenCalledTimes(1);
  });

  it('tells two writes of the same mailing apart', () => {
    const { cache } = makeCache();
    cache.sanitizeCached(version('m1', '01', '<p>a</p>'));
    expect(cache.peek(version('m1', '02'))).toBeUndefined();
  });

  // A translated copy, then its preview: two writes can share a millisecond,
  // so an updatedAt alone may name two versions.
  it('tells apart two versions written within the same millisecond, by their length', () => {
    const { sanitize, cache } = makeCache();
    cache.sanitizeCached(version('m1', '01', '<p>copy</p>'));
    expect(cache.sanitizeCached(version('m1', '01', '<p>translated</p>'))).toBe(
      'clean:<p>translated</p>'
    );
    expect(sanitize).toHaveBeenCalledTimes(2);
    // Without the HTML, the version held is the last one sanitized.
    expect(cache.peek(version('m1', '01'))).toBe('clean:<p>translated</p>');
  });

  it('leaves out an entry past the cap', () => {
    const { sanitize, cache } = makeCache({ budget: 1000, maxEntry: 100 });
    const big = version('m1', '01', 'x'.repeat(200));
    expect(cache.sanitizeCached(big)).toHaveLength(206);
    cache.sanitizeCached(big);
    expect(sanitize).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used first', () => {
    const { cache } = makeCache({ budget: 100, maxEntry: 50 });
    cache.sanitizeCached(version('a', '01', 'a'.repeat(30)));
    cache.sanitizeCached(version('b', '01', 'b'.repeat(30)));
    // `a` was used again: `b` is now the oldest.
    cache.peek(version('a', '01'));
    cache.sanitizeCached(version('c', '01', 'c'.repeat(30)));
    expect(cache.peek(version('a', '01'))).toBeDefined();
    expect(cache.peek(version('b', '01'))).toBeUndefined();
    expect(cache.peek(version('c', '01'))).toBeDefined();
  });
});
