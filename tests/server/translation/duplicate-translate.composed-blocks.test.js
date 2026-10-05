'use strict';

// Duplicate + translate, end to end, for a mailing holding a composed block
// and an HTML code block side by side.
//
// The real translation service, injectors, generator and preview pipeline;
// only the provider, the job store and the database are mocked. The unit
// tests cover each piece — this is what holds them together: the keys the
// service extracts are the ones the injector writes back, the markup it
// rebuilds is what the preview swaps in, and the pasted block comes out of
// all of it byte for byte.

const {
  mailingService,
  Templates,
  element,
  composedBlock,
  zone,
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
  element('el-1', 'text', { content: 'Bonjour <strong>à tous</strong>' }),
  element('el-2', 'image', {
    src: 'https://cdn.example/chat.png',
    alt: 'Un chat',
  }),
  element('el-3', 'button', {
    label: 'Découvrir',
    href: 'https://example.com',
  }),
]);

// Pasted markup sharing wording with the rest, and an ESP script the
// sanitizer would strip.
const PASTED =
  '<p>Bienvenue</p><script type="text/x-esp">{{ unsubscribe }}</script>';

const PREVIEW = [
  '<!DOCTYPE html><html lang="fr"><head><title>Source</title></head><body>',
  '<table class="vb-outer"><tr><td>Bienvenue</td></tr></table>',
  zone('lp-builder-block-root', 'lp-builder-block', COMPOSED.builderHtml),
  zone('lp-html-block-root', 'lp-html-block', PASTED),
  '</body></html>',
].join('');

const SOURCE = {
  _company: 'group',
  _wireframe: 'template',
  name: 'Source',
  data: {
    mainBlocks: {
      blocks: [
        { type: 'titleBlock', text: 'Bienvenue' },
        COMPOSED,
        { type: 'htmlCodeBlock', htmlCode: PASTED },
      ],
    },
  },
  headCss: '',
  previewHtml: PREVIEW,
};

const DICTIONARY = {
  Bienvenue: 'Welcome',
  'Bonjour <strong>à tous</strong>': 'Hello <strong>everyone</strong>',
  'Un chat': 'A cat',
  Découvrir: 'Discover',
  Source: 'Source',
};

const composedOf = (data) => data.mainBlocks.blocks[1];

beforeEach(() => {
  resetMocks();
  Templates.findById.mockResolvedValue({
    markup: '',
    blockBuilderEnabled: true,
  });
  mailingService.findOneForUser.mockResolvedValue(SOURCE);
});

describe('duplicate + translate a mailing with a composed block', () => {
  beforeEach(() => givenProvider((value) => DICTIONARY[value] || value));

  it('translates the composed block in the copy, and rebuilds its markup', async () => {
    const { data } = await duplicateAndTranslate();
    const block = composedOf(data);

    const state = parseState(block.builderState);
    expect(state.elements.map((e) => e.content || e.alt || e.label)).toEqual([
      'Hello <strong>everyone</strong>',
      'A cat',
      'Discover',
    ]);
    // Never translated, only regenerated: the markup is what the state makes.
    expect(block.builderHtml).toBe(generate(state));
    expect(block.builderHtml).toContain('alt="A cat"');
    expect(block.builderHtml).toContain('href="https://example.com"');
  });

  it('shows the rebuilt block in the copy’s preview', async () => {
    const { data, preview } = await duplicateAndTranslate();

    expect(preview).toContain(
      zone(
        'lp-builder-block-root',
        'lp-builder-block',
        composedOf(data).builderHtml
      )
    );
    expect(preview).not.toContain('Découvrir');
  });

  it('translates the template’s own text around it', async () => {
    const { preview } = await duplicateAndTranslate();

    expect(preview).toContain('<td>Welcome</td>');
  });

  // Excluded from translation everywhere, and kept out of the sanitizer.
  it('leaves the HTML code block byte for byte, in the copy and its preview', async () => {
    const { data, preview } = await duplicateAndTranslate();

    expect(data.mainBlocks.blocks[2].htmlCode).toBe(PASTED);
    expect(preview).toContain(
      zone('lp-html-block-root', 'lp-html-block', PASTED)
    );
  });

  it('asks the user to check nothing more than usual', async () => {
    const { result } = await duplicateAndTranslate();

    expect(result.previewGenerated).toBe(true);
    expect(result.warningKeys).not.toContain(
      'translation.warnings.composedBlockUntranslated'
    );
  });
});

// A provider that hands every text back unchanged must leave the composed
// block exactly as the editor stored it: what the server regenerates is what
// the editor generated, byte for byte. Anything else would mean the two sides
// disagree, and every translation would rewrite approved markup.
describe('an identity translation', () => {
  beforeEach(() => givenProvider((value) => value));

  it('gives back the stored markup byte for byte', async () => {
    const { data } = await duplicateAndTranslate();

    expect(composedOf(data).builderHtml).toBe(COMPOSED.builderHtml);
  });

  it('gives back the stored state', async () => {
    const { data } = await duplicateAndTranslate();

    expect(composedOf(data).builderState).toBe(COMPOSED.builderState);
  });

  it('leaves the composed zone of the preview as it was', async () => {
    const { preview } = await duplicateAndTranslate();

    expect(preview).toContain(
      zone('lp-builder-block-root', 'lp-builder-block', COMPOSED.builderHtml)
    );
  });
});

describe('a composed block written by another generator version', () => {
  beforeEach(() => givenProvider((value) => DICTIONARY[value] || value));

  it('is translated, and the user is told to check it', async () => {
    const stale = {
      ...COMPOSED,
      builderHtml: '<table><tr><td>old</td></tr></table>',
    };
    mailingService.findOneForUser.mockResolvedValue({
      ...SOURCE,
      data: { mainBlocks: { blocks: [stale] } },
      previewHtml: zone(
        'lp-builder-block-root',
        'lp-builder-block',
        stale.builderHtml
      ),
    });

    const { data, preview, result } = await duplicateAndTranslate();

    const [block] = data.mainBlocks.blocks;
    expect(block.builderHtml).toBe(generate(parseState(block.builderState)));
    expect(block.builderHtml).toContain('Discover');
    expect(preview).toContain(block.builderHtml);
    expect(result.warningKeys).toContain(
      'translation.warnings.composedBlockUntranslated'
    );
  });
});
