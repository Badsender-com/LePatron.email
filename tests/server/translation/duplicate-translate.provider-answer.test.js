'use strict';

// Duplicate + translate writes back only what it asked for. The provider's
// answer is reduced to the keys that were sent — anything else it returns is
// dropped before any injector sees it — and a composed block is translated,
// hence rebuilt, only on a template that allows the builder.

const {
  mailingService,
  Templates,
  element,
  composedBlock,
  givenProvider,
  resetMocks,
  duplicateAndTranslate,
} = require('./duplicate-translate.harness.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

const COMPOSED = composedBlock([
  element('el-1', 'text', { content: 'Bonjour' }),
  element('el-2', 'button', {
    label: 'Découvrir',
    href: 'https://example.com',
  }),
]);
const SOURCE = {
  _company: 'group',
  _wireframe: 'template',
  name: 'Source',
  data: {
    mainBlocks: {
      blocks: [{ type: 'titleBlock', text: 'Bienvenue' }, COMPOSED],
    },
  },
  headCss: '',
  previewHtml: '',
};
const DICTIONARY = {
  Bienvenue: 'Welcome',
  Bonjour: 'Hello',
  Découvrir: 'Discover',
  Source: 'Source',
};

const translate = (value) => DICTIONARY[value] || value;

const givenTemplate = (blockBuilderEnabled) =>
  Templates.findById.mockResolvedValue({ markup: '', blockBuilderEnabled });

beforeEach(() => {
  resetMocks();
  mailingService.findOneForUser.mockResolvedValue(SOURCE);
});

describe('an answer holding keys that were not sent', () => {
  beforeEach(() => {
    givenTemplate(true);
    givenProvider(translate, {
      'builderBlock.mainBlocks.1.1.href': 'https://other.example',
      'data.mainBlocks.blocks.1.builderHtml': '<p>replaced</p>',
      'data.mainBlocks.blocks.0.type': 'otherBlock',
    });
  });

  it('writes only the texts that were sent', async () => {
    const { data } = await duplicateAndTranslate();
    const [title, block] = data.mainBlocks.blocks;
    const state = parseState(block.builderState);

    expect(title).toEqual({ type: 'titleBlock', text: 'Welcome' });
    expect(state.elements[1].label).toBe('Discover');
    expect(state.elements[1].href).toBe('https://example.com');
  });

  it('stores the markup the translated state generates', async () => {
    const { data } = await duplicateAndTranslate();
    const block = data.mainBlocks.blocks[1];

    expect(block.builderHtml).toBe(generate(parseState(block.builderState)));
    expect(block.builderHtml).not.toContain('replaced');
  });
});

describe('a template without the builder', () => {
  beforeEach(() => {
    givenTemplate(false);
    givenProvider(translate);
  });

  it('copies the composed block as it is', async () => {
    const { data } = await duplicateAndTranslate();
    const block = data.mainBlocks.blocks[1];

    expect(block.builderState).toBe(COMPOSED.builderState);
    expect(block.builderHtml).toBe(COMPOSED.builderHtml);
  });

  it('still translates the rest of the mailing', async () => {
    const { data } = await duplicateAndTranslate();

    expect(data.mainBlocks.blocks[0].text).toBe('Welcome');
  });
});
