/**
 * @jest-environment jsdom
 */

'use strict';

const createDOMPurify = require('dompurify');
const {
  neutralizeHtmlForPreview,
} = require('../../../packages/editor/src/js/ext/html-code-block/neutralize-html.js');

// The editor gets DOMPurify as a global from the concatenated libs; inject an
// instance here instead of faking that global.
const purifier = createDOMPurify(window);
const neutralize = (html) => neutralizeHtmlForPreview(html, purifier);

describe('neutralizeHtmlForPreview', () => {
  describe('strips anything executable', () => {
    const dangerous = [
      ['inline script', '<script>window.pwned = 1</script>'],
      ['img onerror', '<img src="x" onerror="window.pwned = 1">'],
      ['svg onload', '<svg onload="window.pwned = 1"></svg>'],
      ['iframe', '<iframe src="https://evil.test"></iframe>'],
      ['javascript: href', '<a href="javascript:window.pwned=1">x</a>'],
      ['object', '<object data="x.swf"></object>'],
      ['embed', '<embed src="x.swf">'],
      ['base', '<base href="https://evil.test/">'],
      ['form', '<form action="https://evil.test"><input></form>'],
      [
        'meta refresh',
        '<meta http-equiv="refresh" content="0;url=https://evil.test">',
      ],
      [
        'link stylesheet',
        '<link rel="stylesheet" href="https://evil.test/x.css">',
      ],
      ['body onload', '<body onload="window.pwned = 1"></body>'],
      [
        'data: html iframe',
        '<iframe src="data:text/html,<script>1</script>"></iframe>',
      ],
    ];

    test.each(dangerous)('neutralizes %s', (_label, html) => {
      const result = neutralize(html);
      expect(result).not.toMatch(/<script/i);
      expect(result).not.toMatch(/<iframe/i);
      expect(result).not.toMatch(/onerror/i);
      expect(result).not.toMatch(/onload/i);
      expect(result).not.toMatch(/javascript:/i);
      expect(result).not.toMatch(/<base/i);
      expect(result).not.toMatch(/<form/i);
      expect(result).not.toMatch(/<object/i);
      expect(result).not.toMatch(/<embed/i);
      expect(result).not.toMatch(/<meta/i);
      expect(result).not.toMatch(/<link/i);
    });
  });

  describe('keeps email markup usable in the preview', () => {
    it('keeps tables and their layout attributes', () => {
      const html =
        '<table width="600" cellpadding="0" cellspacing="0" border="0" align="center">' +
        '<tr><td align="left" valign="top">hello</td></tr></table>';
      const result = neutralize(html);
      expect(result).toContain('<table');
      expect(result).toContain('width="600"');
      expect(result).toContain('cellpadding="0"');
      expect(result).toContain('align="center"');
      expect(result).toContain('hello');
    });

    it('keeps inline styles', () => {
      const result = neutralize(
        '<table><tr><td style="color: red; font-size: 12px">x</td></tr></table>'
      );
      expect(result).toContain('color: red');
    });

    // Documents a real limitation of the preview: an orphan <tr>/<td> is dropped
    // (by DOMPurify here, and by the browser's HTML parser anyway). This is why
    // the block asks for a complete table — see the CodeMirror placeholder.
    it('drops table cells pasted outside a table', () => {
      const result = neutralize('<td style="color: red">x</td>');
      expect(result).toBe('x');
    });

    it('keeps images and links', () => {
      const html =
        '<a href="https://example.test/page"><img src="https://example.test/a.png" alt="a"></a>';
      const result = neutralize(html);
      expect(result).toContain('href="https://example.test/page"');
      expect(result).toContain('src="https://example.test/a.png"');
      expect(result).toContain('alt="a"');
    });

    it('keeps a target attribute', () => {
      const result = neutralize(
        '<a href="https://a.test" target="_blank">x</a>'
      );
      expect(result).toContain('target="_blank"');
    });

    // The pasted markup is never parsed by Knockout (controlsDescendantBindings),
    // so a data-bind is inert; it is kept because we neutralize execution only.
    it('leaves a pasted data-bind alone', () => {
      const result = neutralize('<div data-bind="text: 1">x</div>');
      expect(result).toContain('data-bind');
    });
  });

  // ESP tags are plain text as far as the DOM is concerned. The preview is not
  // the export, but a mangled preview would still be misleading.
  describe('ESP personalization tags survive the preview', () => {
    const tags = [
      ['handlebars', '<td>{{firstname}}</td>', '{{firstname}}'],
      ['percent', '<td>%%firstname%%</td>', '%%firstname%%'],
      ['percent accents', '<td>%%prénom%%</td>', '%%prénom%%'],
      ['mailchimp', '<td>*|FNAME|*</td>', '*|FNAME|*'],
      [
        'handlebars block',
        '<td>{{#if vip}}VIP{{/if}}</td>',
        '{{#if vip}}VIP{{/if}}',
      ],
    ];

    test.each(tags)('keeps %s', (_label, html, expected) => {
      expect(neutralize(html)).toContain(expected);
    });
  });

  describe('edge cases', () => {
    it('returns an empty string for empty or non-string input', () => {
      expect(neutralize('')).toBe('');
      expect(neutralize(null)).toBe('');
      expect(neutralize(undefined)).toBe('');
      expect(neutralize(42)).toBe('');
    });

    // Fail closed: a preview that renders nothing beats an XSS sink. Export is
    // unaffected either way, since it never goes through this function.
    it('renders nothing when no sanitizer is available', () => {
      expect(neutralizeHtmlForPreview('<b>x</b>', {})).toBe('');
      expect(neutralizeHtmlForPreview('<b>x</b>', { sanitize: null })).toBe('');
    });

    it('does not execute anything while sanitizing', () => {
      delete window.pwned;
      neutralize('<img src="x" onerror="window.pwned = 1">');
      neutralize('<script>window.pwned = 1</script>');
      expect(window.pwned).toBeUndefined();
    });
  });
});
