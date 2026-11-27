'use strict';

// Writing a composed block's translation back: into its state, and into the
// markup rebuilt from it (see builder-block-texts.test.js for why both).

const {
  injectBuilderTexts,
  extractBuilderTexts,
} = require('../../../packages/server/translation/builder-block-texts.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  composedBlock,
  rowsBlock,
  text,
  button,
  modelWith,
} = require('./composed-block.fixtures.js');

describe('writing the translation back', () => {
  it('updates the state', () => {
    const data = modelWith(composedBlock([text('Bonjour'), button('Cliquez')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
      'builderBlock.mainBlocks.0.1.label': 'Click',
    });

    const state = JSON.parse(data.mainBlocks.blocks[0].builderState);
    expect(state.elements[0].content).toBe('Hello');
    expect(state.elements[1].label).toBe('Click');
  });

  // The bug this whole module exists to prevent: a translated state and a
  // stored markup still in the old language, disagreeing forever.
  it('rebuilds the markup from the translated state', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
    });

    expect(data.mainBlocks.blocks[0].builderHtml).toContain('Hello');
    expect(data.mainBlocks.blocks[0].builderHtml).not.toContain('Bonjour');
  });

  // Pinned on the bytes, not on another call to `generate`: an expectation
  // computed with the function under test would agree with any generator,
  // including a broken one. A template change that moves these bytes on
  // purpose updates them here.
  it('rebuilds exactly the markup the editor would store', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
    });

    expect(data.mainBlocks.blocks[0].builderHtml).toBe(
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center" bgcolor="transparent" style="width:600px;max-width:100%;background-color:transparent;">' +
        '<tr><td style="padding:0px 0 0px 0;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        '<tr><td align="left" style="padding:8px 24px 8px 24px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:21px; color:#000000; mso-line-height-rule:exactly;">' +
        'Hello' +
        '</td></tr></table></td></tr>' +
        '</table></td></tr></table>'
    );
  });

  it('reports what it did', () => {
    const data = modelWith(composedBlock([text('Bonjour'), button('Cliquez')]));

    expect(
      injectBuilderTexts(data, {
        'builderBlock.mainBlocks.0.0.content': 'Hello',
        'builderBlock.mainBlocks.0.1.label': 'Click',
      })
    ).toMatchObject({ blocksUpdated: 1, applied: 2, skipped: [] });
  });

  it('regenerates each block once, however many texts it holds', () => {
    const data = modelWith(
      composedBlock([text('Un'), button('Deux')]),
      composedBlock([text('Trois')])
    );

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'One',
      'builderBlock.mainBlocks.0.1.label': 'Two',
      'builderBlock.mainBlocks.1.0.content': 'Three',
    });

    expect(result.blocksUpdated).toBe(2);
    expect(data.mainBlocks.blocks[0].builderHtml).toContain('One');
    expect(data.mainBlocks.blocks[1].builderHtml).toContain('Three');
  });
});

describe('a translation that does not fit is dropped, never guessed', () => {
  test.each([
    ['a key that does not parse', { 'builderBlock.nope': 'x' }],
    [
      'a block index that is not one',
      { 'builderBlock.mainBlocks.9.0.content': 'x' },
    ],
    [
      'a container that does not exist',
      { 'builderBlock.ghost.0.0.content': 'x' },
    ],
    [
      'an element index past the end',
      { 'builderBlock.mainBlocks.0.9.content': 'x' },
    ],
    [
      'a field the element does not have',
      { 'builderBlock.mainBlocks.0.0.caption': 'x' },
    ],
    // `Number('')` is 0: an empty segment must not land on the first block.
    ['an empty block index', { 'builderBlock.mainBlocks..0.content': 'x' }],
    ['an empty element index', { 'builderBlock.mainBlocks.0..content': 'x' }],
    [
      'an index that is not an integer',
      { 'builderBlock.mainBlocks.0.0x0.content': 'x' },
    ],
    ['a negative index', { 'builderBlock.mainBlocks.-0.0.content': 'x' }],
    ['an empty field', { 'builderBlock.mainBlocks.0.0.': 'x' }],
    [
      'a value that is not a string',
      { 'builderBlock.mainBlocks.0.0.content': 42 },
    ],
  ])('%s', (_label, translations) => {
    const data = modelWith(composedBlock([text('Bonjour')]));
    const before = data.mainBlocks.blocks[0].builderHtml;

    const result = injectBuilderTexts(data, translations);

    expect(result.applied).toBe(0);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(before);
  });

  it('does not touch a block whose type is not the builder', () => {
    const data = modelWith({
      type: 'htmlCodeBlock',
      htmlCode: '<p>Bonjour</p>',
    });

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
    });

    expect(data.mainBlocks.blocks[0].htmlCode).toBe('<p>Bonjour</p>');
  });

  it('does nothing at all when there is nothing to inject', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));
    const before = data.mainBlocks.blocks[0].builderHtml;

    expect(injectBuilderTexts(data, {})).toMatchObject({
      blocksUpdated: 0,
      applied: 0,
    });
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(before);
  });
});

describe('a composition of rows', () => {
  const twoColumns = () => {
    const state = {
      ...emptyState(),
      rows: [
        {
          id: 'row-a-1',
          columns: [
            { width: 66, elements: [text('Bonjour')] },
            { width: 34, elements: [button('Cliquez')] },
          ],
        },
      ],
    };
    return {
      type: 'blockBuilderBlock',
      builderState: serialiseState(state),
      builderHtml: generate(state),
    };
  };

  it('is keyed in document order, column by column', () => {
    expect(extractBuilderTexts(modelWith(twoColumns()))).toEqual({
      'builderBlock.mainBlocks.0.0.content': 'Bonjour',
      'builderBlock.mainBlocks.0.1.label': 'Cliquez',
    });
  });

  it('keeps its rows and columns through a translation', () => {
    const data = modelWith(twoColumns());

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
      'builderBlock.mainBlocks.0.1.label': 'Click',
    });

    const [block] = data.mainBlocks.blocks;
    const stored = JSON.parse(block.builderState);
    expect(stored.v).toBe(2);
    expect(stored.elements).toBeUndefined();
    const { columns } = parseState(block.builderState).rows[0];
    // 66 / 34 as stored, read in px of the 600px block.
    expect(columns.map((column) => column.width)).toEqual([396, 204]);
    expect(columns[0].elements[0].content).toBe('Hello');
    expect(columns[1].elements[0].label).toBe('Click');
    expect(block.builderHtml).toBe(generate(parseState(block.builderState)));
    expect(block.builderHtml).toContain('width="66%"');
  });

  // Two rows, the first in two columns: elements are numbered across rows as
  // well, row by row, then column by column.
  const twoRows = () =>
    rowsBlock([
      [[text('Gauche')], [button('Cliquez')]],
      [[text('Dessous', { id: 'e4' })]],
    ]);

  it('is keyed across several rows, row by row', () => {
    expect(extractBuilderTexts(modelWith(twoRows()))).toEqual({
      'builderBlock.mainBlocks.0.0.content': 'Gauche',
      'builderBlock.mainBlocks.0.1.label': 'Cliquez',
      'builderBlock.mainBlocks.0.2.content': 'Dessous',
    });
  });

  it('writes each translation back into its own row and column', () => {
    const data = modelWith(twoRows());

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Left',
      'builderBlock.mainBlocks.0.1.label': 'Click',
      'builderBlock.mainBlocks.0.2.content': 'Below',
    });

    const { rows } = parseState(data.mainBlocks.blocks[0].builderState);
    expect(result).toMatchObject({ applied: 3, blocksUpdated: 1 });
    expect(rows.map((row) => row.id)).toEqual([
      'row-fixture-1',
      'row-fixture-2',
    ]);
    expect(rows[0].columns[0].elements[0].content).toBe('Left');
    expect(rows[0].columns[1].elements[0].label).toBe('Click');
    expect(rows[1].columns[0].elements[0].content).toBe('Below');
  });

  it('drops a key past the last element of the last row', () => {
    const data = modelWith(twoRows());
    const before = data.mainBlocks.blocks[0].builderHtml;

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.3.content': 'Nowhere',
    });

    expect(result).toMatchObject({
      applied: 0,
      skipped: ['builderBlock.mainBlocks.0.3.content'],
    });
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(before);
  });

  // A block stored flat, before columns existed, keeps the keys it always
  // had, and the block in rows after it is numbered on its own.
  it('leaves the keys of a flat block before it as they were', () => {
    const data = modelWith(
      composedBlock([text('Bonjour'), button('Cliquez')]),
      twoRows()
    );

    expect(Object.keys(extractBuilderTexts(data))).toEqual([
      'builderBlock.mainBlocks.0.0.content',
      'builderBlock.mainBlocks.0.1.label',
      'builderBlock.mainBlocks.1.0.content',
      'builderBlock.mainBlocks.1.1.label',
      'builderBlock.mainBlocks.1.2.content',
    ]);
    expect(JSON.parse(data.mainBlocks.blocks[0].builderState).v).toBe(1);
  });
});
