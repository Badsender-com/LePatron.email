'use strict';

const {
  sanitizePreviewHtml,
} = require('../../../packages/server/translation/preview-html-sanitizer.js');

describe('preview-html-sanitizer (stored-XSS protection)', () => {
  it('strips script tags injected via provider output', () => {
    const dirty = '<p>hello</p><script>alert(1)</script>';
    const clean = sanitizePreviewHtml(dirty);
    expect(clean).toContain('hello');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert(1)');
  });

  it('strips inline event handlers (img onerror)', () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = sanitizePreviewHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('alert(1)');
  });

  it('neutralizes javascript: URLs', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    const clean = sanitizePreviewHtml(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('preserves email-safe structure (tables, inline styles, images)', () => {
    const dirty =
      '<html><head><style>td{color:red}</style></head><body>' +
      '<table><tr><td style="padding:8px">Bonjour</td></tr></table>' +
      '<img src="https://cdn.example.com/a.png"></body></html>';
    const clean = sanitizePreviewHtml(dirty);
    expect(clean).toContain('<table');
    expect(clean).toContain('<td');
    expect(clean).toContain('Bonjour');
    expect(clean).toContain('padding:8px');
    expect(clean).toContain('https://cdn.example.com/a.png');
  });

  it('passes through empty / non-string input unchanged', () => {
    expect(sanitizePreviewHtml('')).toBe('');
    expect(sanitizePreviewHtml(null)).toBe(null);
    expect(sanitizePreviewHtml(undefined)).toBe(undefined);
  });
});
