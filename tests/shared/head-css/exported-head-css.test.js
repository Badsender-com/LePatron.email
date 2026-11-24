'use strict';

// The one rule for what an export carries in its <head>, shared by the
// editor's export and canvas and by the copies the server writes.

const {
  exportedHeadCss,
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
});
