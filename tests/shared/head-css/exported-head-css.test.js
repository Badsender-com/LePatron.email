'use strict';

// The one rule for what an export carries in its <head>, shared by the
// editor's export and canvas and by the copies the server writes.

const {
  exportedHeadCss,
  leadingStatementsOf,
} = require('../../../packages/shared/head-css/exported-head-css.js');

const AUTHOR = '.author-note{color:red}';

const composed = (widths) =>
  JSON.stringify({
    v: 2,
    gen: '1.0.0',
    rows: [
      {
        id: 'r1',
        columns: widths.map((width, index) => ({
          width,
          elements: [{ id: `e${index}`, type: 'text', content: 'x' }],
        })),
      },
    ],
  });

const TWO_COLUMNS = composed([50, 50]);

describe('exportedHeadCss', () => {
  it('is the derived stylesheet alone for a composed block alone', () => {
    const css = exportedHeadCss({
      composedStates: [TWO_COLUMNS],
      hasHtmlCodeBlock: false,
      authorCss: AUTHOR,
    });

    expect(css).toMatch(/^@media[^{]*\{\.lp-stack\{[^}]*\}\}$/);
  });

  it('is the author stylesheet as stored with an HTML code block alone', () => {
    expect(
      exportedHeadCss({
        composedStates: [],
        hasHtmlCodeBlock: true,
        authorCss: AUTHOR,
      })
    ).toBe(AUTHOR);
  });

  it('leaves the author stylesheet out without an HTML code block', () => {
    expect(
      exportedHeadCss({
        composedStates: [composed([100])],
        hasHtmlCodeBlock: false,
        authorCss: AUTHOR,
      })
    ).toBe('');
  });

  it('puts the derived stylesheet first, so the author has the last word', () => {
    const css = exportedHeadCss({
      composedStates: [TWO_COLUMNS],
      hasHtmlCodeBlock: true,
      authorCss: AUTHOR,
    });

    expect(css.endsWith(AUTHOR)).toBe(true);
    expect(css.indexOf('.lp-stack{')).toBeLessThan(css.indexOf(AUTHOR));
  });

  test.each([
    ['not a string', 42],
    ['nothing', undefined],
  ])('takes an author stylesheet that is %s as none', (_label, authorCss) => {
    expect(
      exportedHeadCss({ composedStates: [], hasHtmlCodeBlock: true, authorCss })
    ).toBe('');
  });

  // An `@import` after any other rule is ignored by the browser: put after the
  // derived rules, a web font the author loads would vanish from the export.
  describe('what CSS only reads at the top', () => {
    const IMPORT = '@import url("https://fonts.example/a.css");';
    const CHARSET = '@charset "utf-8";';

    it('keeps the author @charset and @import above the derived rules', () => {
      const css = exportedHeadCss({
        composedStates: [TWO_COLUMNS],
        hasHtmlCodeBlock: true,
        authorCss: `${CHARSET}\n${IMPORT}\n${AUTHOR}`,
      });

      expect(css.startsWith(`${CHARSET}\n${IMPORT}@media`)).toBe(true);
      expect(css.endsWith(`\n${AUTHOR}`)).toBe(true);
    });

    it('changes nothing when there is no derived rule to go above', () => {
      const authorCss = `${IMPORT}\n${AUTHOR}`;

      expect(
        exportedHeadCss({
          composedStates: [],
          hasHtmlCodeBlock: true,
          authorCss,
        })
      ).toBe(authorCss);
    });
  });
});

describe('leadingStatementsOf', () => {
  test.each([
    [
      'imports and comments between them',
      '/* fonts */ @import "a.css"; /* more */\n@IMPORT url(b.css);\n.a{}',
      '/* fonts */ @import "a.css"; /* more */\n@IMPORT url(b.css);',
    ],
    [
      'a semicolon inside a URL',
      '@import url(a.css?x=1;y=2);.a{}',
      '@import url(a.css?x=1;y=2);',
    ],
    [
      'a semicolon inside a quoted URL',
      '@import "a;b.css";.a{}',
      '@import "a;b.css";',
    ],
    [
      'a namespace and a layer statement',
      '@layer base;@import "a.css" layer(base);@namespace svg url(x);.a{}',
      '@layer base;@import "a.css" layer(base);@namespace svg url(x);',
    ],
    ['an import after a rule', '.a{}@import "a.css";', ''],
    ['an import that never ends', '@import "a.css"', ''],
    ['a layer block', '@layer base{.a{}}', ''],
    ['an unterminated comment', '/* @import "a.css";', ''],
    ['an at-rule that only starts the same', '@imports "a.css";.a{}', ''],
    ['nothing', '', ''],
  ])('splits %s', (_label, css, head) => {
    const split = leadingStatementsOf(css);

    expect(split.head).toBe(head);
    expect(split.head + split.rest).toBe(css);
  });
});
