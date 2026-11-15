'use strict';

// What a saved block becomes in the palette, from the entry the library
// returns. It is the object a click or a drag inserts as it is, so it is where
// insertion is decided.

const {
  generate,
  GENERATOR_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  paletteEntryOf,
} = require('../../../packages/editor/src/js/vue/components/personalized-blocks-list/palette-entry.js');

const STALE_STATE = JSON.stringify({
  v: 1,
  gen: '0.9.0',
  elements: [{ id: 'a', type: 'text', content: 'Bonjour' }],
});

const libraryItem = (content) => ({
  _id: '6af8d97d5a86a79f311eaf47',
  name: 'Essai',
  category: 'Divers',
  userDetails: { name: 'Camille' },
  content,
});

const COMPOSED = libraryItem({
  type: 'blockBuilderBlock',
  id: 'ko_blockBuilderBlock_3',
  builderState: STALE_STATE,
  builderHtml: '<p>what an earlier generator wrote</p>',
});

const TEMPLATE_BLOCK = libraryItem({
  type: 'heroBlock',
  id: 'ko_heroBlock_1',
  title: 'Titre',
});

describe('inserting a saved composed block', () => {
  it('inserts the rendering of the current generator', () => {
    const entry = paletteEntryOf(COMPOSED);

    expect(entry.builderHtml).toBe(generate(parseState(STALE_STATE)));
  });

  it('inserts a composition that states the current generator', () => {
    const entry = paletteEntryOf(COMPOSED);

    expect(JSON.parse(entry.builderState).gen).toBe(GENERATOR_VERSION);
  });

  it('leaves a saved template block exactly as stored', () => {
    const entry = paletteEntryOf(TEMPLATE_BLOCK);

    expect(entry).toMatchObject({ type: 'heroBlock', title: 'Titre' });
  });

  // The editor gives an inserted block its own id; one carried over from the
  // email it was saved from would be shared by every copy.
  it.each([
    ['composed', COMPOSED],
    ['template', TEMPLATE_BLOCK],
  ])('inserts a %s block without the id it was saved with', (label, item) => {
    expect(paletteEntryOf(item).id).toBe('');
  });

  it('keeps what the palette shows about the entry', () => {
    expect(paletteEntryOf(COMPOSED).blockInformation).toMatchObject({
      _id: COMPOSED._id,
      name: 'Essai',
      category: 'Divers',
    });
  });

  // The first save stores it in the email with the block: nothing about the
  // entry's author beyond the name the palette prints.
  it('keeps nothing else about the entry or its author', () => {
    const item = {
      ...TEMPLATE_BLOCK,
      _group: 'g',
      userDetails: {
        name: 'Camille',
        email: 'camille@example.test',
        role: 'x',
      },
    };

    expect(paletteEntryOf(item).blockInformation).toEqual({
      _id: TEMPLATE_BLOCK._id,
      name: 'Essai',
      category: 'Divers',
      userDetails: { name: 'Camille' },
    });
  });

  it('names an entry whose author is gone after the admin', () => {
    const { userDetails: _author, ...orphan } = TEMPLATE_BLOCK;

    expect(paletteEntryOf(orphan).blockInformation.userDetails).toEqual({
      name: 'admin',
    });
  });
});
