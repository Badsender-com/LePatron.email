'use strict';

// The head CSS a copy the server writes carries — a translated duplicate's
// previewHtml. The rule is shared with the editor (packages/shared/head-css/
// exported-head-css.js); what is pinned here is that the server reads its
// inputs off a plain content model.

const {
  headCssToExport,
} = require('../../../packages/server/mailing/head-css-export.js');

// The CSS follows the HTML code blocks, not the flag: what the server writes
// into a stored copy (a translated duplicate's previewHtml) obeys the editor's
// export rule. The flag plays no part here — it gates writing the CSS, above.
describe('headCssToExport', () => {
  const CSS = '.a{color:red}';
  const block = { type: 'htmlCodeBlock', htmlCode: '<p>x</p>' };

  test('is the CSS while the content holds an HTML code block', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [block] } },
        headCss: CSS,
      })
    ).toBe(CSS);
  });

  test('looks at every top-level container', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [] }, footerBlocks: { blocks: [block] } },
        headCss: CSS,
      })
    ).toBe(CSS);
  });

  test('is nothing without any HTML code block', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [{ type: 'textBlock' }] } },
        headCss: CSS,
      })
    ).toBe('');
    expect(headCssToExport({ data: undefined, headCss: CSS })).toBe('');
  });

  // A composed block derives its own rules; it does not keep the author's
  // CSS exported. This one has no state, so it derives nothing either.
  test('is nothing with a block builder block only', () => {
    expect(
      headCssToExport({
        data: {
          mainBlocks: {
            blocks: [{ type: 'blockBuilderBlock', builderHtml: '<p>x</p>' }],
          },
        },
        headCss: CSS,
      })
    ).toBe('');
  });

  test('is nothing when no CSS is stored', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [block] } },
        headCss: undefined,
      })
    ).toBe('');
  });
});

// A composed block with two columns: it derives a stacking rule.
const composedBlock = () => ({
  type: 'blockBuilderBlock',
  builderHtml: '<table></table>',
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

describe('headCssToExport with composed blocks', () => {
  test('is the derived stylesheet, with no HTML code block', () => {
    const css = headCssToExport({
      data: { mainBlocks: { blocks: [composedBlock()] } },
      headCss: '.a{color:red}',
    });

    expect(css).toMatch(/^@media[^{]*max-width:600px/);
    expect(css).not.toContain('.a{');
  });

  test('reads composed blocks in every top-level container', () => {
    expect(
      headCssToExport({
        data: {
          mainBlocks: { blocks: [] },
          footerBlocks: { blocks: [composedBlock()] },
        },
        headCss: '',
      })
    ).toContain('.lp-stack{');
  });
});
