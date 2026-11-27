'use strict';

// The editing panel names a synthetic block in the user's language.
//
// Mosaico titles a block's panel with the label its template declares, through
// `viewModel.ut`, which returns it as written. A synthetic block's label is
// declared by LePatron, in English (block-types.js): the panel read "Composed
// block" and "HTML code" in a French editor, beside a palette entry that said
// "Bloc composé". Their label is now read through the palette's own key; every
// other label of the template stays as written.

const {
  templateLabel,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/block-state.js');
const {
  BLOCK_BUILDER_BLOCK,
  HTML_CODE_BLOCK,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/block-types.js');
const fr = require('../../../public/lang/badsender-fr.js');

const t = (key) => fr[key] || key;

describe('a label in the editing panel', () => {
  it('is the composed block’s palette name', () => {
    expect(templateLabel(t, BLOCK_BUILDER_BLOCK.label)).toBe('Bloc composé');
  });

  it('is the HTML code block’s palette name', () => {
    expect(templateLabel(t, HTML_CODE_BLOCK.label)).toBe('Code HTML');
  });

  it('is left as the template wrote it otherwise', () => {
    expect(templateLabel(t, 'Template Options')).toBe('Template Options');
    expect(templateLabel(t, undefined)).toBeUndefined();
  });
});
