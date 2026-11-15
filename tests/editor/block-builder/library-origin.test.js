/**
 * @jest-environment jsdom
 */

'use strict';

// A composed block inserted from the block library remembers the entry it came
// from (ADR 0027), so that synchronised blocks (#1545) and usage statistics
// (#1546) can one day account for the blocks inserted from now on. Nothing
// shows it and nothing uses it yet.
//
// Run against the REAL converter and checkModel, like builder-state-survives:
// the reverse pass of checkModel deletes from stored content every property
// the block definitions do not declare. That is what erases the library's
// `blockInformation` from an inserted block at the first reopening — found by
// saving, reopening and saving again in the editor — and what the origin has
// to survive.

const jQuery = require('jquery');
const ko = require('knockout');

global.$ = global.jQuery = jQuery;
global.ko = ko;

const {
  injectSyntheticBlocks,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/inject-synthetic-blocks.js');
const {
  BLOCK_BUILDER_BLOCK,
  HTML_CODE_BLOCK,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/block-types.js');
const converter = require('../../../packages/editor/src/js/converter/main.js');
const modelDef = require('../../../packages/editor/src/js/converter/model.js');

const ORIGIN = 'libraryOrigin';
const ENTRY_ID = '6af8d97d5a86a79f311eaf47';

const TEMPLATE = [
  '<html><head><style type="text/css">@supports -ko-blockdefs {',
  '  text { label: Text; widget: text; }',
  '}</style></head>',
  '<body><div data-ko-container="main" data-ko-wrap="false"></div></body></html>',
].join('');

const markStructuralTags = (html) =>
  html.replace(
    /(<\/?)(html|head|body)([^>]*>)/gi,
    (match, open, tag, rest) => open + 'replaced' + tag + rest
  );

let templateDef;
const templates = {};

beforeAll(() => {
  templateDef = converter.translateTemplate(
    'template',
    markStructuralTags(injectSyntheticBlocks(TEMPLATE)),
    () => null,
    (htmlOrElement, name, mode) => {
      const key = name && mode ? `${name}-${mode}` : name || 'anon';
      templates[key] =
        typeof htmlOrElement === 'object'
          ? htmlOrElement.outerHTML
          : htmlOrElement;
      return key;
    }
  );
});

const generatedBlock = (type) =>
  modelDef.generateModel(templateDef._defs, type);

// checkModel as the editor calls it (template-loader.js): the GENERATED model
// first, the STORED content third.
const reopen = (stored) =>
  converter.checkModel(generatedBlock(stored.type), templateDef._defs, stored);

const libraryItem = (content) => ({
  _id: ENTRY_ID,
  name: 'Essai',
  category: 'Divers',
  content,
});

describe('an inserted composed block remembers its library entry', () => {
  let paletteEntryOf;

  beforeAll(() => {
    // Required here: the module does not exist until #1565 ships it.
    ({
      paletteEntryOf,
    } = require('../../../packages/editor/src/js/vue/components/personalized-blocks-list/palette-entry.js'));
  });

  it('is declared by the composed block, and by it alone', () => {
    expect(BLOCK_BUILDER_BLOCK.originProperty).toBe(ORIGIN);
    expect(generatedBlock(BLOCK_BUILDER_BLOCK.type)).toHaveProperty(ORIGIN);
    expect(generatedBlock(HTML_CODE_BLOCK.type)).not.toHaveProperty(ORIGIN);
  });

  it('is set when the block is inserted from the library', () => {
    const entry = paletteEntryOf(
      libraryItem({
        type: BLOCK_BUILDER_BLOCK.type,
        builderHtml: '',
        builderState: '',
      })
    );

    expect(entry[ORIGIN]).toBe(ENTRY_ID);
  });

  it('is not set on a saved template block', () => {
    const entry = paletteEntryOf(libraryItem({ type: 'heroBlock' }));

    expect(entry).not.toHaveProperty(ORIGIN);
  });

  it('survives reopening the email', () => {
    const stored = {
      type: BLOCK_BUILDER_BLOCK.type,
      builderHtml: '<p>x</p>',
      builderState: '{"v":1,"elements":[]}',
      [ORIGIN]: ENTRY_ID,
    };

    const verdict = reopen(stored);

    expect(stored[ORIGIN]).toBe(ENTRY_ID);
    // 0 = compatible, 1 = fixed, 2 = incompatible (template-loader.js).
    expect(verdict).toBeLessThan(2);
  });

  it('is generated empty, so a block composed in the email has none', () => {
    expect(generatedBlock(BLOCK_BUILDER_BLOCK.type)[ORIGIN]).toBeNull();
  });

  it('is never shown in the settings panel nor exported', () => {
    const rendered = Object.entries(templates)
      .filter(([name]) => name.startsWith(BLOCK_BUILDER_BLOCK.type))
      .map(([, html]) => html)
      .join('\n');

    expect(rendered).not.toContain(ORIGIN);
  });
});
