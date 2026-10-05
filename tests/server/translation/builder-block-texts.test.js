'use strict';

// Translating a composed block.
//
// The generic extractor cannot see any of it: everything the user wrote sits
// inside `builderState`, one long JSON string whose field name matches no
// pattern and whose value is not prose. A mailing with composed blocks came
// back from translation with those blocks still in the source language, and
// nothing said so.
//
// The part that is easy to get wrong, and the reason this file exists: it is
// not enough to translate the state. `builderHtml` is what gets exported, so it
// has to be rebuilt from the translated state — by the same generator the
// editor uses, which is the whole reason that module is shared rather than
// living in the editor.

const {
  extractBuilderTexts,
  splitBuilderTranslations,
  BUILDER_KEY_PREFIX,
} = require('../../../packages/server/translation/builder-block-texts.js');
const {
  composedBlock,
  text,
  button,
  image,
  modelWith,
} = require('./composed-block.fixtures.js');

describe('what gets sent for translation', () => {
  it('finds the prose inside a composed block', () => {
    const data = modelWith(composedBlock([text('Bonjour'), button('Cliquez')]));

    expect(extractBuilderTexts(data)).toEqual({
      'builderBlock.mainBlocks.0.0.content': 'Bonjour',
      'builderBlock.mainBlocks.0.1.label': 'Cliquez',
    });
  });

  // Which fields count is decided by the element's manifest: TEXT and
  // RICH_TEXT slots, and an ATTR declared translatable — `alt`, not `align`.
  it('takes an image alt, which is prose too', () => {
    const data = modelWith(composedBlock([image('Une photo de chat')]));

    expect(extractBuilderTexts(data)).toEqual({
      'builderBlock.mainBlocks.0.0.alt': 'Une photo de chat',
    });
  });

  it('leaves colours, sizes and links alone', () => {
    const data = modelWith(
      composedBlock([
        text('Bonjour', { color: '#ff0000', fontSize: 18 }),
        button('Cliquez'),
      ])
    );

    const keys = Object.keys(extractBuilderTexts(data));

    expect(keys).toEqual([
      'builderBlock.mainBlocks.0.0.content',
      'builderBlock.mainBlocks.0.1.label',
    ]);
    expect(keys).not.toContain('builderBlock.mainBlocks.0.0.color');
    expect(keys).not.toContain('builderBlock.mainBlocks.0.0.fontSize');
    expect(keys).not.toContain('builderBlock.mainBlocks.0.1.href');
  });

  // `align` is an ATTR like `alt`, but a keyword the markup depends on: a
  // translated `center` is no alignment at all.
  it('never sends an ATTR slot the manifest does not declare translatable', () => {
    const data = modelWith(
      composedBlock([text('Bonjour', { align: 'center' }), image('Un chat')])
    );

    expect(Object.keys(extractBuilderTexts(data))).toEqual([
      'builderBlock.mainBlocks.0.0.content',
      'builderBlock.mainBlocks.0.1.alt',
    ]);
  });

  // The field names no longer decide: a URL slot is refused by its context,
  // whatever text it holds.
  it('never sends a link, even one that reads like prose', () => {
    const data = modelWith(
      composedBlock([{ ...button('Cliquez'), href: 'voir la suite' }])
    );

    expect(Object.values(extractBuilderTexts(data))).toEqual(['Cliquez']);
  });

  // The markup is generated. Sending it to an LLM would have it rewritten, and
  // the block's promise is that Badsender owns that HTML.
  it('never sends the generated markup', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    Object.values(extractBuilderTexts(data)).forEach((value) => {
      expect(value).not.toContain('<table');
    });
    expect(Object.keys(extractBuilderTexts(data))).not.toContain(
      'builderBlock.mainBlocks.0.0.builderHtml'
    );
  });

  it('keeps the rich text as markup, so formatting survives the round trip', () => {
    const data = modelWith(
      composedBlock([text('Du <strong>gras</strong> et un <em>reste</em>')])
    );

    expect(
      extractBuilderTexts(data)['builderBlock.mainBlocks.0.0.content']
    ).toBe('Du <strong>gras</strong> et un <em>reste</em>');
  });

  it('numbers blocks and elements so two blocks do not collide', () => {
    const data = modelWith(
      composedBlock([text('Premier')]),
      { type: 'textBlock' },
      composedBlock([text('Second')])
    );

    expect(Object.keys(extractBuilderTexts(data)).sort()).toEqual([
      'builderBlock.mainBlocks.0.0.content',
      'builderBlock.mainBlocks.2.0.content',
    ]);
  });

  test.each([
    ['no data', undefined],
    ['an empty model', {}],
    [
      'a model with no composed block',
      { mainBlocks: { blocks: [{ type: 'x' }] } },
    ],
    [
      'a block whose state cannot be read',
      {
        mainBlocks: {
          blocks: [{ type: 'blockBuilderBlock', builderState: 'nope' }],
        },
      },
    ],
  ])('finds nothing in %s', (_label, data) => {
    expect(extractBuilderTexts(data)).toEqual({});
  });
});

describe('keys are kept away from the generic injector', () => {
  // It resolves a key as a dot path into the model. A builder key is not one:
  // it would walk into `data.builderBlock`, find nothing, and be reported as a
  // failed injection — a warning nobody can act on.
  it('splits them out', () => {
    const { builder, rest } = splitBuilderTranslations({
      'data.mainBlocks.blocks.0.text': 'Salut',
      'builderBlock.mainBlocks.0.0.content': 'Bonjour',
      _name: 'Objet',
    });

    expect(Object.keys(builder)).toEqual([
      'builderBlock.mainBlocks.0.0.content',
    ]);
    expect(Object.keys(rest).sort()).toEqual([
      '_name',
      'data.mainBlocks.blocks.0.text',
    ]);
  });

  it('tolerates nothing to split', () => {
    expect(splitBuilderTranslations(undefined)).toEqual({
      builder: {},
      rest: {},
    });
  });

  it('uses a prefix a model path cannot produce', () => {
    // Model paths from the generic extractor always start with `data.`.
    expect(BUILDER_KEY_PREFIX).not.toBe('data');
  });
});
