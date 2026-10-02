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
  injectBuilderTexts,
  BUILDER_KEY_PREFIX,
} = require('../../../packages/server/translation/builder-block-texts.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');

/** A composed block, stored the way the editor stores it. */
function composedBlock(elements) {
  const state = { ...emptyState(), elements };
  return {
    type: 'blockBuilderBlock',
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

const text = (content, overrides) => ({
  id: 'e1',
  type: 'text',
  content,
  ...overrides,
});
const button = (label) => ({ id: 'e2', type: 'button', label, href: '#' });
const image = (alt) => ({ id: 'e3', type: 'image', alt, src: '', href: '' });

const modelWith = (...blocks) => ({ mainBlocks: { blocks } });

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

  it('rebuilds with the real generator, not a copy of it', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'Hello',
    });

    const expected = generate({
      ...emptyState(),
      elements: [text('Hello')],
    });
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(expected);
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

describe('a translation that would blow past the size limit', () => {
  const {
    HTML_CODE_MAX_LENGTH,
  } = require('../../../packages/server/mailing/synthetic-block-guard.js');

  // The save route enforces this limit, and it never sees this write: the
  // translated copy is persisted by `duplicateWithTranslatedData`. The value
  // now comes from a provider's response rather than something a user typed,
  // and `previewHtml` keeps a second copy in the same document, against
  // Mongo's 16MB ceiling.
  it('leaves the block exactly as it was', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));
    const before = { ...data.mainBlocks.blocks[0] };

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
    });

    expect(result.oversized).toBe(1);
    expect(result.blocksUpdated).toBe(0);
    expect(data.mainBlocks.blocks[0].builderHtml).toBe(before.builderHtml);
    expect(data.mainBlocks.blocks[0].builderState).toBe(before.builderState);
  });

  // Refusing rather than truncating: a block left in the source language is
  // visible and recoverable, half a table is not.
  it('never writes a truncated block', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
    });

    expect(data.mainBlocks.blocks[0].builderHtml.length).toBeLessThan(
      HTML_CODE_MAX_LENGTH
    );
  });

  // One bad block must not cost the whole mailing its translation.
  it('translates the other blocks all the same', () => {
    const data = modelWith(
      composedBlock([text('Trop long')]),
      composedBlock([text('Raisonnable')])
    );

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(
        HTML_CODE_MAX_LENGTH + 1
      ),
      'builderBlock.mainBlocks.1.0.content': 'Reasonable',
    });

    expect(result.oversized).toBe(1);
    expect(result.blocksUpdated).toBe(1);
    expect(data.mainBlocks.blocks[1].builderHtml).toContain('Reasonable');
  });

  it('accepts a translation that stays under the limit', () => {
    const data = modelWith(composedBlock([text('Bonjour')]));

    const result = injectBuilderTexts(data, {
      'builderBlock.mainBlocks.0.0.content': 'x'.repeat(1000),
    });

    expect(result.oversized).toBe(0);
    expect(result.blocksUpdated).toBe(1);
  });
});
