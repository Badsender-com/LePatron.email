'use strict';

// This is the security model of the generator, so the tests are written as
// attacks rather than as examples. The POC of March 2026 shipped an XSS through
// one forgotten escape call; here a value cannot reach the output without
// declaring where it lands.

const {
  escapeForContext,
  isSafeUrl,
  TEXT,
  ATTR,
  URL,
  COLOR,
  PX,
  CSS_VALUE,
} = require('../../../packages/shared/block-builder/slot-contexts.js');

describe('TEXT', () => {
  it('neutralises a tag', () => {
    expect(escapeForContext('<script>alert(1)</script>', TEXT)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes the ampersand first, so nothing is double-escaped', () => {
    expect(escapeForContext('&lt;', TEXT)).toBe('&amp;lt;');
  });

  it('leaves quotes alone, which are harmless in text', () => {
    expect(escapeForContext('it\'s "fine"', TEXT)).toBe('it\'s "fine"');
  });
});

describe('ATTR', () => {
  // Closing the attribute early is how a value becomes an event handler.
  it('neutralises a quote breaking out of the attribute', () => {
    expect(escapeForContext('" onerror="alert(1)', ATTR)).toBe(
      '&quot; onerror=&quot;alert(1)'
    );
  });

  it('neutralises a single quote too', () => {
    expect(escapeForContext("' onload='x", ATTR)).toContain('&#39;');
  });
});

describe('URL', () => {
  test.each([
    ['https', 'https://example.com/a?b=1'],
    ['http', 'http://example.com'],
    ['mailto', 'mailto:a@example.com'],
    ['tel', 'tel:+33100000000'],
    ['relative', '/assets/x.png'],
    ['anchor', '#top'],
    ['an ESP tag', '<%= profile.url %>'],
    ['a handlebars tag', '{{unsubscribe}}'],
    ['a percent tag', '%%unsubscribe%%'],
    ['a bracketed token', '[unsubscribe_link]'],
  ])('keeps %s', (_label, url) => {
    expect(escapeForContext(url, URL, 'FALLBACK')).not.toBe('FALLBACK');
  });

  test.each([
    ['javascript', 'javascript:alert(1)'],
    ['javascript with padding', '  javascript:alert(1)'],
    ['uppercase javascript', 'JAVASCRIPT:alert(1)'],
    ['data', 'data:text/html;base64,PHNjcmlwdD4='],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['an empty string', ''],
  ])('refuses %s', (_label, url) => {
    expect(escapeForContext(url, URL, 'FALLBACK')).toBe('FALLBACK');
  });

  it('escapes the URL it keeps, so it cannot end the attribute', () => {
    expect(escapeForContext('https://e.com/"onload="x', URL)).toContain(
      '&quot;'
    );
  });

  it('exposes the rule on its own', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('COLOR', () => {
  test.each([
    '#fff',
    '#ffffff',
    '#ffffffcc',
    'rgb(1,2,3)',
    'rgba(1,2,3,.5)',
    'red',
  ])('keeps %s', (value) => {
    expect(escapeForContext(value, COLOR, '#000')).toBe(value);
  });

  test.each([
    ['a declaration break', 'red;background:url(x)'],
    ['an expression', 'expression(alert(1))'],
    ['a tag', '<script>'],
  ])('falls back on %s', (_label, value) => {
    expect(escapeForContext(value, COLOR, '#000')).toBe('#000');
  });
});

describe('PX', () => {
  it('keeps a number', () => {
    expect(escapeForContext('16', PX, '0')).toBe('16');
    expect(escapeForContext(24, PX, '0')).toBe('24');
  });

  it('keeps only the leading number of a padded value', () => {
    expect(escapeForContext('16px', PX, '0')).toBe('16');
  });

  it('falls back on anything that is not one', () => {
    expect(escapeForContext('1;}body{display:none', PX, '0')).toBe('1');
    expect(escapeForContext('abc', PX, '0')).toBe('0');
  });
});

describe('CSS_VALUE', () => {
  it('keeps a plain value', () => {
    expect(escapeForContext('0 auto', CSS_VALUE, '')).toBe('0 auto');
  });

  test.each([
    ['a declaration break', 'red;background:black'],
    ['a block close', 'red}body{display:none'],
    ['a url call', 'url(http://evil/x)'],
    ['an expression', 'expression(alert(1))'],
    ['an import', '@import "evil.css"'],
    ['a tag', '</style><script>'],
  ])('falls back on %s', (_label, value) => {
    expect(escapeForContext(value, CSS_VALUE, 'FALLBACK')).toBe('FALLBACK');
  });
});

describe('robustness', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
  ])('treats %s as empty', (_label, value) => {
    expect(escapeForContext(value, TEXT)).toBe('');
  });

  // A generator that throws on something the user typed takes the canvas with
  // it. Refusals return a fallback; they never raise.
  it('never throws, whatever the context', () => {
    [TEXT, ATTR, URL, COLOR, PX, CSS_VALUE, 'NONSENSE'].forEach((context) => {
      expect(() => escapeForContext({}, context, '')).not.toThrow();
    });
  });

  // An unknown context is a template bug: escape hardest, so the mistake shows
  // as over-escaped output rather than as an injection.
  it('falls back to attribute escaping for an unknown context', () => {
    expect(escapeForContext('"<x>', 'NONSENSE')).toBe('&quot;&lt;x&gt;');
  });
});
