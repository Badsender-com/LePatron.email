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

// The text comes from a paste or a stored state, and is sanitised on every
// render of the preview. Each of these shapes took seconds per 100KB with the
// regexes the scanner replaced: a `<` the scan read to the end of the input
// from every start, or an attribute name read again from each of its letters.
describe('adversarial input stays linear', () => {
  const SIZE = 100000;
  const BUDGET_MS = 200;

  test.each([
    ['`<a` never closed', '<a'.repeat(SIZE / 2)],
    ['`<a ` never closed', '<a '.repeat(SIZE / 3)],
    ['an unclosed quote in every tag', '<a "'.repeat(SIZE / 4)],
    ['one very long attribute name', `<a ${'a'.repeat(SIZE)}>x</a>`],
    ['mixed quotes', '<b x="\''.repeat(SIZE / 7)],
  ])('%s', (_label, html) => {
    const started = Date.now();
    sanitizeRichText(html);
    expect(Date.now() - started).toBeLessThan(BUDGET_MS);
  });

  it('still reads a well-formed tag after a run of unclosed ones', () => {
    expect(sanitizeRichText(`${'<a '.repeat(1000)}"<b>x</b>`)).toContain(
      '<b>x</b>'
    );
  });
});

// TinyMCE writes markup: `&nbsp;`, `&amp;`. A character reference is text the
// browser decodes, so it is kept as written — escaped again, it showed up as
// `&nbsp;` in the preview and broke every link with a query string.
describe('character references', () => {
  it.each([
    ['a named one', 'espace&nbsp;', 'espace&nbsp;'],
    ['an accented one', '&eacute;t&eacute;', '&eacute;t&eacute;'],
    ['a decimal one', '&#233;', '&#233;'],
    ['a hexadecimal one', '&#xE9;', '&#xE9;'],
    ['an escaped tag', '&lt;b&gt;', '&lt;b&gt;'],
    ['an escaped ampersand', 'a &amp; b', 'a &amp; b'],
  ])('keeps %s in text', (_label, input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected);
  });

  it.each([
    ['a bare ampersand', 'a & b', 'a &amp; b'],
    ['something that is not a reference', '&bogus x', '&amp;bogus x'],
    ['an unterminated one', '&nbsp', '&amp;nbsp'],
  ])('escapes %s', (_label, input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected);
  });

  it('keeps the query string of a link as TinyMCE wrote it', () => {
    expect(sanitizeRichText('<a href="https://e.com/?a=1&amp;b=2">x</a>')).toBe(
      '<a href="https://e.com/?a=1&amp;b=2">x</a>'
    );
  });

  // The URL is judged once decoded: a reference cannot spell out a scheme or
  // a host the check would have refused written plainly.
  it.each([
    ['an encoded scheme letter', 'jav&#97;script:x'],
    ['an encoded leading letter', '&#106;avascript:x'],
    ['a hexadecimal one', '&#x6A;avascript:x'],
  ])('drops a link whose decoded URL is refused (%s)', (_label, href) => {
    expect(sanitizeRichText(`<a href="${href}">x</a>`)).toBe('<a>x</a>');
  });

  it('drops a NUL from the text', () => {
    expect(sanitizeRichText('a\u0000b')).toBe('ab');
  });
});
