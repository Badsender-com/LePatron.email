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
//
// What has to hold is the SHAPE OF THE CURVE, not a duration. These tests used
// to assert `< 200ms` on one run, and that is what made them flaky: the scanner
// needs 3 to 30ms here, so the assertion had a 7x to 60x margin and still went
// red at 209ms — it was measuring how much CPU a Jest worker got among 245
// suites, not the code. Loosening the threshold would only move the noise
// floor.
//
// So each shape is measured at N and at 2N. Linear doubles; the quadratic this
// guards against quadruples, and turns milliseconds into seconds. That signal
// is enormous, which is exactly why it does not need a tight bound: a loaded
// machine slows both measurements alike and leaves the ratio alone.
describe('adversarial input stays linear', () => {
  const SIZE = 100000;

  // Doubling the input may not even double the time (the shorter shapes are
  // partly dominated by setup), so the bound sits between what linear produces
  // and the 4x of a quadratic regression.
  const MAX_RATIO = 3;

  // Checked on ONE run at the smaller size, BEFORE anything larger is measured.
  // That order matters: a quadratic scanner cannot be interrupted from inside
  // the test — the call is synchronous, so Jest's own timeout cannot fire — and
  // measuring the doubled input first would simply hang. Deliberately far above
  // the ~30ms this costs; it fires on a scanner that stopped making progress,
  // never on a busy machine.
  const CEILING_MS = 2000;

  const timeOf = (html) => {
    const started = process.hrtime.bigint();
    sanitizeRichText(html);
    return Number(process.hrtime.bigint() - started) / 1e6;
  };

  // The minimum of a few runs, not the mean: contention only ever ADDS time, so
  // the fastest run is the one least polluted by everything else on the machine.
  const fastestOf = (html, runs = 3) => {
    let best = Infinity;
    for (let i = 0; i < runs; i += 1) best = Math.min(best, timeOf(html));
    return best;
  };

  test.each([
    ['`<a` never closed', (n) => '<a'.repeat(n / 2)],
    ['`<a ` never closed', (n) => '<a '.repeat(n / 3)],
    ['an unclosed quote in every tag', (n) => '<a "'.repeat(n / 4)],
    ['one very long attribute name', (n) => `<a ${'a'.repeat(n)}>x</a>`],
    ['mixed quotes', (n) => '<b x="\''.repeat(n / 7)],
  ])('%s', (_label, build) => {
    const single = build(SIZE);

    // Cheap guard first, on a cold call: catches a scanner that blew up, while
    // the input is still small enough for the failure to arrive in seconds.
    expect(timeOf(single)).toBeLessThan(CEILING_MS);

    const double = build(SIZE * 2);
    // Warm up on the larger shape too, so the first measured run is not the one
    // paying for JIT.
    sanitizeRichText(double);

    expect(fastestOf(double) / fastestOf(single)).toBeLessThan(MAX_RATIO);
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
    ['an encoded second slash', '/&#47;example.com'],
    ['a hexadecimal one', '&#x6A;avascript:x'],
  ])('drops a link whose decoded URL is refused (%s)', (_label, href) => {
    expect(sanitizeRichText(`<a href="${href}">x</a>`)).toBe('<a>x</a>');
  });

  it('drops a NUL from the text', () => {
    expect(sanitizeRichText('a\u0000b')).toBe('ab');
  });
});
