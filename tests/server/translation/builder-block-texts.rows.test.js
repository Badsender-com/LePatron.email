'use strict';

// Translating a composed block stored in rows of columns.
//
// Found by driving the editor in a browser, not by the suite: duplicating and
// translating an email failed outright — "Cannot read properties of undefined
// (reading 'forEach')" — as soon as it held one block composed in rows. The
// translation read the composition's flat `elements` list, which only a
// composition stored as version 1 has. It now reads every element through
// elementsOfState (composition.js), whatever the stored shape.
//
// The elements are numbered in document order, row by row and column by
// column — the order a flat composition already used — so the keys of a block
// stored before columns do not change.

const {
  extractBuilderTexts,
  injectBuilderTexts,
} = require('../../../packages/server/translation/builder-block-texts.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  composedBlock,
  rowsBlock,
  text,
  button,
  modelWith,
} = require('./composed-block.fixtures.js');

const twoColumns = () =>
  rowsBlock([
    [[text('Gauche')], [{ ...button('Cliquez'), id: 'e2' }]],
    [[{ ...text('Dessous'), id: 'e4' }]],
  ]);

describe('a composed block stored in rows', () => {
  it('sends every text, in document order', () => {
    expect(extractBuilderTexts(modelWith(twoColumns()))).toEqual({
      'builderBlock.mainBlocks.0.0.content': 'Gauche',
      'builderBlock.mainBlocks.0.1.label': 'Cliquez',
      'builderBlock.mainBlocks.0.2.content': 'Dessous',
    });
  });

  it('writes each translation back into its own column', () => {
    const data = modelWith(twoColumns());

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Left',
      'builderBlock.mainBlocks.0.1.label': 'Click',
      'builderBlock.mainBlocks.0.2.content': 'Below',
    });

    const state = JSON.parse(data.mainBlocks.blocks[0].builderState);
    expect(result).toMatchObject({ applied: 3, blocksUpdated: 1 });
    expect(state.rows[0].columns[0].elements[0].content).toBe('Left');
    expect(state.rows[0].columns[1].elements[0].label).toBe('Click');
    expect(state.rows[1].columns[0].elements[0].content).toBe('Below');
  });

  it('stays in rows, and rebuilds the markup the editor would store', () => {
    const data = modelWith(twoColumns());

    injectBuilderTexts(data, { 'builderBlock.mainBlocks.0.0.content': 'Left' });

    const block = data.mainBlocks.blocks[0];
    const state = JSON.parse(block.builderState);
    expect(state).not.toHaveProperty('elements');
    expect(block.builderHtml).toBe(generate(parseState(block.builderState)));
    expect(block.builderHtml).toContain('Left');
    expect(block.builderHtml).not.toContain('Gauche');
  });

  it('drops a key that points past the last element', () => {
    const data = modelWith(twoColumns());

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.3.content': 'Nowhere',
    });

    expect(result.skipped).toEqual(['builderBlock.mainBlocks.0.3.content']);
  });

  it('keeps the keys of a block stored before columns', () => {
    const data = modelWith(
      composedBlock([text('Bonjour'), button('Cliquez')]),
      twoColumns()
    );

    expect(Object.keys(extractBuilderTexts(data))).toEqual([
      'builderBlock.mainBlocks.0.0.content',
      'builderBlock.mainBlocks.0.1.label',
      'builderBlock.mainBlocks.1.0.content',
      'builderBlock.mainBlocks.1.1.label',
      'builderBlock.mainBlocks.1.2.content',
    ]);
  });
});
