'use strict';

const { escapeHtml } = require('../../../packages/ui/helpers/escape-html');

describe('escapeHtml', () => {
  it('returns an empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves a plain string untouched', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });

  it('escapes < and > to prevent tag injection', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it('escapes a full script tag attack payload', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands first so already-encoded entities are double-encoded safely', () => {
    // The order matters: if we replaced & last, "&lt;" in the input would slip through.
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes single and double quotes (attribute breakout)', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe(
      '&quot; onmouseover=&quot;alert(1)'
    );
    expect(escapeHtml("' onmouseover='alert(1)")).toBe(
      '&#39; onmouseover=&#39;alert(1)'
    );
  });

  it('coerces non-string values to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });
});
