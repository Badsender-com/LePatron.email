'use strict';

const { JSDOM } = require('jsdom');

const {
  sanitizePreviewHtml,
  sanitizeSharedPreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

// What a browser makes of the HTML once it renders it again (the srcdoc).
const reparsed = (html) => new JSDOM(html).window.document;

describe('sanitizeSharedPreviewHtml (the public share page)', () => {
  it('opens every web link in a new tab, without an opener', () => {
    const doc = reparsed(
      sanitizeSharedPreviewHtml(
        '<html><head></head><body><a href="https://a.test" target="win" rel="opener">a</a><map><area href="https://b.test" target="_top"></map><a href=" HTTP://c.test ">c</a><a href="//d.test/x">d</a></body></html>'
      )
    );
    const links = doc.querySelectorAll('a, area');
    expect(links).toHaveLength(4);
    links.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  // In the sandboxed frame, a link with a target opens a tab: "back to top"
  // must scroll, and a mailto: must go to the mail client, not to a blank tab.
  it.each([
    ['an anchor of the email', '<a href="#top" target="_blank">top</a>'],
    ['an empty href', '<a href="" target="_blank">x</a>'],
    ['no href at all', '<a name="top" target="_blank">x</a>'],
    ['a mailto:', '<a href="mailto:a@b.test" target="_blank">mail</a>'],
    ['a tel:', '<a href="tel:+33100000000" target="_top">call</a>'],
    ['an area of the email', '<map><area href="#top" target="_blank"></map>'],
  ])('keeps %s inside the frame', (_label, html) => {
    const doc = reparsed(sanitizeSharedPreviewHtml(`<body>${html}</body>`));
    const link = doc.querySelector('a, area');
    expect(link).not.toBeNull();
    expect(link.hasAttribute('target')).toBe(false);
  });

  it('treats a link drawn in an SVG like any other', () => {
    const doc = reparsed(
      sanitizeSharedPreviewHtml(
        '<body><svg><a href="https://a.test"><text>a</text></a><a href="#top"><text>top</text></a></svg></body>'
      )
    );
    const [web, anchor] = doc.querySelectorAll('svg a');
    expect(web.getAttribute('target')).toBe('_blank');
    expect(web.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor.hasAttribute('target')).toBe(false);
  });

  it('lets nothing come back through an attribute that looks like markup', () => {
    // A <head> written inside an attribute value: a string edit of the
    // sanitized HTML matched it and turned the class back into markup.
    const dirty =
      '<html class="><img src=x onerror=alert(1)>" title="<head>"><body><p>Hi</p></body></html>';
    const doc = reparsed(sanitizeSharedPreviewHtml(dirty));
    expect(doc.querySelector('[onerror]')).toBeNull();
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('base')).toBeNull();
    expect(doc.body.textContent).toContain('Hi');
  });

  it('applies the preview rules too', () => {
    const clean = sanitizeSharedPreviewHtml(
      '<p>hi</p><script>alert(1)</script><base href="https://evil.test">'
    );
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<base');
  });
});

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
