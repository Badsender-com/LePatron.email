'use strict';

// Characterises the head CSS channel.
//
// The contract that matters most is the first one: a mailing without head CSS
// must export exactly what it exported before this feature existed. Everything
// else in this feature is additive, and this test is what keeps it that way.

const {
  injectHeadCss,
  MARKER_ATTRIBUTE,
} = require('../../../packages/shared/head-css/inject-head-css.js');

const DOC = [
  '<!DOCTYPE html>',
  '<html>',
  '<head>',
  '<title>Hello</title>',
  '</head>',
  '<body><p>Body</p></body>',
  '</html>',
].join('\n');

describe('injectHeadCss', () => {
  describe('when there is nothing to inject', () => {
    test.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
      ['whitespace only', '   \n\t  '],
      ['a number', 42],
    ])('returns the document untouched for %s', (_label, css) => {
      expect(injectHeadCss(DOC, css)).toBe(DOC);
    });

    test('returns non-string documents untouched', () => {
      expect(injectHeadCss(undefined, 'a{color:red}')).toBeUndefined();
      expect(injectHeadCss('', 'a{color:red}')).toBe('');
    });
  });

  describe('injection', () => {
    test('places the stylesheet just before </head>', () => {
      const out = injectHeadCss(DOC, '.a{color:red}');

      expect(out).toContain(
        '<style type="text/css" ' +
          MARKER_ATTRIBUTE +
          '="true">.a{color:red}</style></head>'
      );
      // The rest of the document is left alone.
      expect(out.replace(/<style[\s\S]*?<\/style>/, '')).toBe(DOC);
    });

    test('keeps the CSS verbatim, including newlines and comments', () => {
      const css =
        '/* héro */\n@media (max-width:600px){\n  .a{width:100% !important}\n}';
      expect(injectHeadCss(DOC, css)).toContain(css);
    });

    test.each([
      ['lowercase', '</head>'],
      ['uppercase', '</HEAD>'],
      ['with inner whitespace', '</head >'],
    ])('finds the closing tag written %s', (_label, closing) => {
      const doc =
        '<html><head><title>t</title>' + closing + '<body></body></html>';
      const out = injectHeadCss(doc, '.a{color:red}');

      expect(out).toContain('.a{color:red}</style>' + closing);
    });

    test.each(['$&', "$'", '$`', '$1', '$$'])(
      'inserts %s in the CSS literally, not as a replacement pattern',
      (pattern) => {
        const css = '.a::after{content:"' + pattern + '"}';
        const out = injectHeadCss(DOC, css);
        expect(out).toContain('="true">' + css + '</style></head>');
        // Same on the replacing path.
        expect(injectHeadCss(out, css)).toBe(out);
      }
    );

    test('leaves a document without a <head> untouched', () => {
      const fragment = '<div>just a fragment</div>';
      expect(injectHeadCss(fragment, '.a{color:red}')).toBe(fragment);
    });
  });

  describe('security', () => {
    test('neutralises a payload trying to close the style element', () => {
      const out = injectHeadCss(DOC, 'a{}</style><script>alert(1)</script>');

      // The element cannot be closed early...
      expect(out).not.toContain('</style><script>');
      // ...and the bytes are still visible to whoever reads the export.
      expect(out).toContain('<\\/style');
      // A single closing tag, the one we control.
      expect(out.match(/<\/style>/g)).toHaveLength(1);
    });

    test.each(['</STYLE>', '</style >', '</StYlE'])(
      'neutralises the closing sequence written %s',
      (variant) => {
        const out = injectHeadCss(DOC, 'a{}' + variant + 'x');
        expect(out.match(/<\/style>/g)).toHaveLength(1);
      }
    );
  });

  describe('idempotence', () => {
    test('replaces the previous stylesheet instead of stacking a second one', () => {
      const once = injectHeadCss(DOC, '.a{color:red}');
      const twice = injectHeadCss(once, '.b{color:blue}');

      expect(twice.match(/<style/g)).toHaveLength(1);
      expect(twice).toContain('.b{color:blue}');
      expect(twice).not.toContain('.a{color:red}');
    });

    test('re-injecting the same CSS is stable', () => {
      const once = injectHeadCss(DOC, '.a{color:red}');
      expect(injectHeadCss(once, '.a{color:red}')).toBe(once);
    });

    test('clearing the CSS removes the element and restores the original export', () => {
      const once = injectHeadCss(DOC, '.a{color:red}');
      expect(injectHeadCss(once, '')).toBe(DOC);
    });

    test('still finds its element when the CSS contains </head>', () => {
      const once = injectHeadCss(DOC, '/* </head> */.a{color:red}');
      const twice = injectHeadCss(once, '.b{color:blue}');

      expect(twice.match(/<style/g)).toHaveLength(1);
      expect(twice.replace(/<style[\s\S]*?<\/style>/, '')).toBe(DOC);
    });

    test('finds its element with the attributes reordered by a sanitizer', () => {
      const sanitized = DOC.replace(
        '</head>',
        '<style ' +
          MARKER_ATTRIBUTE +
          '="true" type="text/css">.a{}</style></head>'
      );
      expect(injectHeadCss(sanitized, '')).toBe(DOC);
    });
  });

  describe('an HTML code block in the body', () => {
    // A block may hold a pasted element carrying the marker: it belongs to the
    // author, and the block promises to export it byte for byte.
    const pasted =
      '<style type="text/css" ' + MARKER_ATTRIBUTE + '="true">.x{}</style>';
    const withBlock = DOC.replace('<p>Body</p>', pasted);

    test('is left untouched when there is no CSS', () => {
      expect(injectHeadCss(withBlock, '')).toBe(withBlock);
    });

    test('is left untouched when CSS is injected in the head', () => {
      const out = injectHeadCss(withBlock, '.a{color:red}');

      expect(out).toContain('<body>' + pasted + '</body>');
      expect(out).toContain('.a{color:red}</style></head>');
    });
  });
});

// One pass over the head: an opening that is never closed does not send the
// search back to the end of the document — and the body is not searched at
// all, where an HTML code block may hold anything.
describe('injectHeadCss — linear on any document', () => {
  it.each([
    [
      'unclosed openings in the head',
      (u) => `<html><head>${u}</head><body></body></html>`,
    ],
    [
      'unclosed openings in the body',
      (u) => `<html><head></head><body>${u}</body></html>`,
    ],
  ])('%s', (_label, build) => {
    ['<style a', '<style>'].forEach((unit) => {
      const html = build(unit.repeat(150000));
      const start = Date.now();

      injectHeadCss(html, '');
      injectHeadCss(html, '.a{color:red}');

      expect(Date.now() - start).toBeLessThan(500);
    });
  });
});
