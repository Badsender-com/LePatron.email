'use strict';

// The canvas is a div of the editor's own document, so unscoped author CSS
// would restyle the toolbox, the panels and the dialogs along with the email.
// What matters here is that nothing escapes the prefix, and that invalid CSS
// — a normal state while typing — applies nothing instead of something wrong.

const {
  scopeCss,
} = require('../../../packages/editor/src/js/ext/head-css/scope-css.js');

const AREA = '#main-wysiwyg-area';

/** Collapses whitespace, so assertions read on the rules and not the layout. */
const flat = (css) => (css === null ? null : css.replace(/\s+/g, ' ').trim());

describe('scopeCss', () => {
  test.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '  \n '],
  ])('returns an empty stylesheet for %s', (_label, css) => {
    expect(scopeCss(css, AREA)).toBe('');
  });

  it('prefixes a plain selector', () => {
    expect(flat(scopeCss('.classred{color:red}', AREA))).toBe(
      '#main-wysiwyg-area .classred { color: red; }'
    );
  });

  it('prefixes every selector of a list', () => {
    expect(flat(scopeCss('.a,.b{color:red}', AREA))).toBe(
      '#main-wysiwyg-area .a, #main-wysiwyg-area .b { color: red; }'
    );
  });

  // A regex splitting on commas gets this wrong; the parser does not.
  it('does not split a comma inside :not()', () => {
    const out = flat(scopeCss('.a:not(.b,.c){color:red}', AREA));
    expect(out).toBe('#main-wysiwyg-area .a:not(.b,.c) { color: red; }');
  });

  it('maps document-level selectors onto the canvas itself', () => {
    expect(flat(scopeCss('body{font-family:Arial}', AREA))).toBe(
      '#main-wysiwyg-area { font-family: Arial; }'
    );
    expect(flat(scopeCss('html,body{margin:0}', AREA))).toBe(
      '#main-wysiwyg-area, #main-wysiwyg-area { margin: 0; }'
    );
  });

  it('descends into media queries', () => {
    const out = flat(
      scopeCss('@media (max-width:600px){.a{width:100%}}', AREA)
    );
    expect(out).toBe(
      '@media (max-width:600px) { #main-wysiwyg-area .a { width: 100%; } }'
    );
  });

  // Percentages and from/to are not selectors — prefixing them breaks the
  // animation outright.
  it('leaves keyframe steps alone', () => {
    const out = flat(
      scopeCss('@keyframes x{from{opacity:0}to{opacity:1}}', AREA)
    );
    expect(out).toContain('from');
    expect(out).not.toContain('#main-wysiwyg-area from');
  });

  it('leaves @font-face alone', () => {
    const out = flat(scopeCss("@font-face{font-family:'X'}", AREA));
    expect(out).toContain('@font-face');
    expect(out).not.toContain('#main-wysiwyg-area {');
  });

  it('does not scope an already scoped selector twice', () => {
    const once = scopeCss('.a{color:red}', AREA);
    expect(flat(scopeCss(once, AREA))).toBe(flat(once));
  });

  describe('when the CSS cannot be used', () => {
    // mensch is lenient, like a browser: it recovers rather than throwing, so a
    // stylesheet in the middle of being typed styles what it can. What matters
    // is that the recovery stays scoped.
    it('recovers from an unclosed block, still scoped', () => {
      expect(flat(scopeCss('.a{color:red', AREA))).toBe(
        '#main-wysiwyg-area .a {}'
      );
    });

    it('returns null without a prefix', () => {
      expect(scopeCss('.a{color:red}', '')).toBeNull();
    });
  });
});
