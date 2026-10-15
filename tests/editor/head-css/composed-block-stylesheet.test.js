'use strict';

// Acceptance tests for the columns slice, at the fourth seam: what stylesheet
// an export carries (epic #1194).
//
// The gate here was written deliberately, and its comment says why: the head
// stylesheet existed to style markup pasted in an HTML code block, and the
// composed block "writes its own styles inline and has nothing for this
// stylesheet to style". That was true while the builder was single-column. A
// stacking rule is the counter-example — it cannot be inlined, because it only
// means anything inside a media query.
//
// So these tests are about a mailing whose ONLY synthetic block is a composed
// one. Today it exports no stylesheet at all, and the canvas shows none either.

// Same bundle alias as the sibling suite: ko-reactor registers `ko.watch`
// rather than exporting it.
jest.mock(
  'knockoutjs-reactor',
  () => {
    require('ko-reactor/dist/ko-reactor.js');
    return {};
  },
  { virtual: true }
);

const ko = require('knockout');

// Not an `lp-` class: that prefix belongs to the generator (ADR 0025), and an
// author's rule written on it would read as a generated one in these tests.
const AUTHOR_CSS = '.author-note{color:red}';

/** A composed block holding two columns, so it derives a stacking rule. */
const composedBlock = () => ({
  type: 'blockBuilderBlock',
  builderHtml:
    '<table><tr><td width="50%">a</td><td width="50%">b</td></tr></table>',
  builderState: JSON.stringify({
    v: 2,
    gen: '1.0.0',
    rows: [
      {
        id: 'r1',
        columns: [
          { width: 50, elements: [{ id: 'e1', type: 'text', content: 'a' }] },
          { width: 50, elements: [{ id: 'e2', type: 'text', content: 'b' }] },
        ],
      },
    ],
  }),
});

const htmlBlock = () => ({ type: 'htmlCodeBlock', htmlCode: '<p>x</p>' });
const textBlock = () => ({ type: 'textBlock', text: 'Hello' });

const field = (value) =>
  Array.isArray(value) ? ko.observableArray(value) : ko.observable(value);

const contentWith = (...blocks) =>
  ko.observable({
    mainBlocks: field({
      blocks: field(blocks.map((block) => ko.observable(block))),
    }),
  });

// Turned on by #1209 (the derived stylesheet reaches the export and the canvas)
describe('a mailing whose only synthetic block is composed', () => {
  let headCssToExport;

  beforeAll(() => {
    ({
      headCssToExport,
    } = require('../../../packages/editor/src/js/ext/head-css/exported-css.js'));
  });

  it('carries the stylesheet its composition derives', () => {
    const css = headCssToExport(contentWith(composedBlock(), textBlock()), '');

    expect(css).toMatch(/@media[^{]*max-width/);
    expect(css).toMatch(/display:\s*block/);
  });

  it('carries it with no author stylesheet stored at all', () => {
    expect(headCssToExport(contentWith(composedBlock()), '')).not.toBe('');
  });

  // With an HTML code block too, because that is what the author's stylesheet
  // follows — the rule this slice did not reopen (ADR 0025). A mailing holding
  // only a composed block carries the derived stylesheet and nothing else,
  // which the next case pins.
  it('carries both, the derived one first', () => {
    const css = headCssToExport(
      contentWith(composedBlock(), htmlBlock()),
      AUTHOR_CSS
    );

    // Searched as a pattern, spaces allowed: a fixed string would not be
    // found in a spaced-out stylesheet, and the order below would then
    // compare -1 against a position and pass on nothing.
    const derivedAt = css.search(/display:\s*block/);
    const authorAt = css.indexOf('.author-note');
    expect(derivedAt).toBeGreaterThan(-1);
    expect(authorAt).toBeGreaterThan(-1);
    // Last wins in CSS at equal specificity, so a hand-written rule has to come
    // after the generated one to be able to override it.
    expect(derivedAt).toBeLessThan(authorAt);
  });

  it('leaves the author stylesheet out while no HTML code block is there', () => {
    const css = headCssToExport(contentWith(composedBlock()), AUTHOR_CSS);

    expect(css).toMatch(/display:\s*block/);
    expect(css).not.toContain('.author-note');
  });

  it('derives nothing from a single-column composition', () => {
    const singleColumn = {
      ...composedBlock(),
      builderState: JSON.stringify({
        v: 2,
        gen: '1.0.0',
        rows: [
          {
            id: 'r1',
            columns: [
              {
                width: 100,
                elements: [{ id: 'e1', type: 'text', content: 'a' }],
              },
            ],
          },
        ],
      }),
    };

    expect(headCssToExport(contentWith(singleColumn), '')).toBe('');
  });

  it('derives nothing from a composed block whose composition is unreadable', () => {
    const broken = { ...composedBlock(), builderState: '{ not json' };

    expect(headCssToExport(contentWith(broken), '')).toBe('');
  });
});

// Turned on by #1209 (the derived stylesheet reaches the export and the canvas)
describe('what the existing rule must keep doing', () => {
  let headCssToExport;

  beforeAll(() => {
    ({
      headCssToExport,
    } = require('../../../packages/editor/src/js/ext/head-css/exported-css.js'));
  });

  it('still exports the author stylesheet while an HTML code block is there', () => {
    expect(headCssToExport(contentWith(htmlBlock()), AUTHOR_CSS)).toContain(
      '.author-note'
    );
  });

  it('still drops the author stylesheet once no block is left to style', () => {
    expect(headCssToExport(contentWith(textBlock()), AUTHOR_CSS)).toBe('');
  });

  it('exports nothing at all for a mailing with neither kind of block', () => {
    expect(headCssToExport(contentWith(textBlock()), '')).toBe('');
  });

  // The server writes copies of its own — a translated duplicate, a preview —
  // and a rule applied on one side only would make them disagree.
  it('is the same rule on the server', () => {
    const serverGuard = require('../../../packages/server/mailing/head-css-guard.js');
    const model = {
      mainBlocks: { blocks: [composedBlock()] },
    };

    const inTheEditor = headCssToExport(contentWith(composedBlock()), '');

    // Two empty strings agree too: the comparison only means something once
    // there is a stylesheet to compare.
    expect(inTheEditor).not.toBe('');
    expect(serverGuard.headCssToExport({ data: model, headCss: '' })).toBe(
      inTheEditor
    );
  });
});
