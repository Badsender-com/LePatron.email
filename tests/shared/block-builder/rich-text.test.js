'use strict';

// The one place in the generator where markup is allowed through, so the tests
// are adversarial by default. The rule being verified is not "dangerous things
// are removed" but "only recognised things survive" — the first is a blacklist
// and fails on the trick nobody thought of; the second fails closed.

const {
  sanitizeRichText,
} = require('../../../packages/shared/block-builder/rich-text.js');

describe('what is allowed', () => {
  test.each([
    ['bold', '<strong>a</strong>'],
    ['b', '<b>a</b>'],
    ['italic', '<em>a</em>'],
    ['i', '<i>a</i>'],
    ['underline', '<u>a</u>'],
  ])('keeps %s', (_label, html) => {
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('keeps a line break, normalised', () => {
    expect(sanitizeRichText('a<br>b')).toBe('a<br />b');
    expect(sanitizeRichText('a<br/>b')).toBe('a<br />b');
  });

  it('keeps a link and its href', () => {
    expect(sanitizeRichText('<a href="https://e.com">go</a>')).toBe(
      '<a href="https://e.com">go</a>'
    );
  });

  it('keeps nesting', () => {
    expect(sanitizeRichText('<strong><em>a</em></strong>')).toBe(
      '<strong><em>a</em></strong>'
    );
  });

  it('keeps ESP personalisation as text', () => {
    expect(sanitizeRichText('Bonjour {{firstname}}')).toBe(
      'Bonjour {{firstname}}'
    );
  });

  it('escapes bare text', () => {
    expect(sanitizeRichText('a & b')).toBe('a &amp; b');
  });
});

describe('what is dropped', () => {
  // The tag goes, the words stay: someone pasting from Word must not lose their
  // sentence to a <span>.
  test.each([
    ['a span', '<span style="color:red">a</span>', 'a'],
    ['a div', '<div>a</div>', 'a'],
    ['a paragraph', '<p>a</p>', 'a'],
    ['an image', 'a<img src="x">b', 'ab'],
    ['a table', '<table><tr><td>a</td></tr></table>', 'a'],
  ])('drops %s and keeps its text', (_label, html, expected) => {
    expect(sanitizeRichText(html)).toBe(expected);
  });

  // Here the content must go too: dropping only the tag would print the script
  // body as visible text.
  test.each([
    ['a script', '<script>alert(1)</script>', ''],
    ['a style', '<style>body{display:none}</style>', ''],
    ['an iframe', '<iframe src="https://evil"></iframe>', ''],
    ['an object', '<object data="x"></object>', ''],
  ])('drops %s with its content', (_label, html, expected) => {
    expect(sanitizeRichText(html)).toBe(expected);
  });

  it('keeps what follows a dropped block', () => {
    expect(sanitizeRichText('<script>x</script>after')).toBe('after');
  });

  it('strips every attribute of an allowed tag but the ones on its list', () => {
    const out = sanitizeRichText(
      '<strong onclick="alert(1)" style="x" class="y">a</strong>'
    );
    expect(out).toBe('<strong>a</strong>');
  });

  it('drops an unsafe href but keeps the words', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">go</a>')).toBe(
      '<a>go</a>'
    );
  });
});

describe('malformed input', () => {
  it('closes what the input left open', () => {
    expect(sanitizeRichText('<strong>a')).toBe('<strong>a</strong>');
  });

  // Otherwise a stray close could end a tag this function opened around it.
  it('ignores a close with no matching open', () => {
    expect(sanitizeRichText('a</strong>b')).toBe('ab');
  });

  it('closes nesting in the right order', () => {
    expect(sanitizeRichText('<strong><em>a')).toBe(
      '<strong><em>a</em></strong>'
    );
  });

  it('treats an unfinished tag as text', () => {
    expect(sanitizeRichText('a < b')).toBe('a &lt; b');
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an empty string', ''],
  ])('returns an empty string for %s', (_label, value) => {
    expect(sanitizeRichText(value)).toBe('');
  });
});

describe('known bypass attempts', () => {
  test.each([
    ['uppercase tag', '<SCRIPT>alert(1)</SCRIPT>'],
    ['mixed case', '<ScRiPt>alert(1)</ScRiPt>'],
    ['attribute with no quotes', '<a href=javascript:alert(1)>go</a>'],
    ['single quoted attribute', "<a href='javascript:alert(1)'>go</a>"],
    [
      'event handler on a link',
      '<a href="https://e.com" onclick="alert(1)">go</a>',
    ],
    [
      'a greater-than inside an attribute',
      '<a href="https://e.com/a>b">go</a>',
    ],
    ['svg', '<svg onload="alert(1)"></svg>'],
    ['a data URL', '<a href="data:text/html,<script>alert(1)</script>">go</a>'],
  ])('neutralises %s', (_label, html) => {
    const out = sanitizeRichText(html);

    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('onload');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('data:text/html');
  });

  it('never emits a tag outside the allow-list', () => {
    const out = sanitizeRichText(
      '<form><input><select><option>a</option></select></form>'
    );
    expect(out).toBe('a');
  });
});
