/**
 * @jest-environment jsdom
 */

'use strict';

// The spike that had to pass before re-editability could be built at all, run
// against the REAL converter and the REAL checkModel rather than a reading of
// their source — which is just as well, because the reading was wrong twice.
//
// What checkModel actually does, and what it means for the builder state:
//
//   1. The reverse pass DELETES from stored content any property the block
//      definitions do not declare ("found in model is not defined by template:
//      removing it!"). This is the real constraint: the state must be declared,
//      or an autosave loses it on the next load.
//
//   2. A type mismatch between stored and generated marks the template
//      obsolete — but every property is generated as `null`, and the type
//      comparison is short-circuited when either side is null
//      (checkmodel.js: `model[prop] !== null && reference[prop] !== null`).
//      So storing a string against a null default alarms nothing. That is the
//      path `htmlCode` has been on in production since it shipped.
//
// Serialising the state to a string is therefore a choice, not a workaround: it
// keeps the stored shape opaque to Mosaico, which has no business walking into
// it.

const jQuery = require('jquery');
const ko = require('knockout');

global.$ = global.jQuery = jQuery;
global.ko = ko;

const {
  injectSyntheticBlocks,
} = require('../../../packages/editor/src/js/ext/html-code-block/inject-synthetic-blocks.js');
const {
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
  BLOCK_BUILDER_BLOCK_TYPE,
  BLOCK_BUILDER_HTML_PROPERTY,
  BUILDER_STATE_PROPERTY,
} = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const converter = require('../../../packages/editor/src/js/converter/main.js');
const modelDef = require('../../../packages/editor/src/js/converter/model.js');

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

beforeAll(() => {
  templateDef = converter.translateTemplate(
    'template',
    markStructuralTags(injectSyntheticBlocks(TEMPLATE)),
    () => null,
    (html, name, mode) => (name && mode ? `${name}-${mode}` : name || 'anon')
  );
});

/** The model Mosaico generates for one block of the given synthetic type. */
const generatedBlock = (type = BLOCK_BUILDER_BLOCK_TYPE) =>
  modelDef.generateModel(templateDef._defs, type);

/**
 * checkModel as the editor calls it (template-loader.js): the GENERATED model
 * first, the STORED content third. Getting that order wrong tests nothing.
 */
const check = (stored, type) =>
  converter.checkModel(generatedBlock(type), templateDef._defs, stored);

describe('the block definitions', () => {
  it('declare the builder state alongside the generated markup', () => {
    const block = generatedBlock();

    expect(block).toHaveProperty(BLOCK_BUILDER_HTML_PROPERTY);
    expect(block).toHaveProperty(BUILDER_STATE_PROPERTY);
  });

  // The default every property gets, and the reason a stored string is safe.
  it('generates it as null, like every other property', () => {
    expect(generatedBlock()[BUILDER_STATE_PROPERTY]).toBeNull();
    expect(generatedBlock()[BLOCK_BUILDER_HTML_PROPERTY]).toBeNull();
  });

  // The builder lives in a block of its own, so the HTML code block must not
  // carry a state property it has no use for — and the reverse pass would
  // delete it from stored content anyway, on every load.
  it('keeps the builder state off the HTML code block', () => {
    const block = generatedBlock(HTML_CODE_BLOCK_TYPE);

    expect(block).toHaveProperty(HTML_CODE_PROPERTY);
    expect(block).not.toHaveProperty(BUILDER_STATE_PROPERTY);
  });
});

describe('checkModel', () => {
  const stored = (extra) => ({
    type: BLOCK_BUILDER_BLOCK_TYPE,
    [BLOCK_BUILDER_HTML_PROPERTY]: '<p>generated</p>',
    ...extra,
  });

  it('keeps a serialised state through a round trip', () => {
    const state = JSON.stringify({
      v: 1,
      elements: [{ id: 'a', type: 'text' }],
    });
    const content = stored({ [BUILDER_STATE_PROPERTY]: state });

    check(content);

    expect(content[BUILDER_STATE_PROPERTY]).toBe(state);
  });

  // A string against a null default: the case that would have been reported as
  // an obsolete template if the comparison were not short-circuited.
  it('does not report the template as obsolete', () => {
    // 0 = compatible, 1 = fixed, 2 = incompatible (template-loader.js).
    expect(check(stored({ [BUILDER_STATE_PROPERTY]: '{"v":1}' }))).toBeLessThan(
      2
    );
  });

  // The regression the declaration exists to prevent.
  it('deletes a property the definitions do not declare', () => {
    const content = stored({
      [BUILDER_STATE_PROPERTY]: '{}',
      somethingUndeclared: 'gone after this',
    });

    check(content);

    expect(content.somethingUndeclared).toBeUndefined();
    expect(content[BUILDER_STATE_PROPERTY]).toBe('{}');
  });

  // A block whose state failed to serialise, or one from a version that kept
  // none.
  it('accepts a block with no state at all', () => {
    const content = stored();

    expect(check(content)).toBeLessThan(2);
    expect(content[BLOCK_BUILDER_HTML_PROPERTY]).toBe('<p>generated</p>');
  });

  // The HTML code block shipped before the builder existed, and its stored
  // blocks must survive the builder's arrival untouched.
  it('leaves an HTML code block stored before the builder existed alone', () => {
    const content = {
      type: HTML_CODE_BLOCK_TYPE,
      [HTML_CODE_PROPERTY]: '<p>pasted</p>',
    };

    expect(check(content, HTML_CODE_BLOCK_TYPE)).toBeLessThan(2);
    expect(content[HTML_CODE_PROPERTY]).toBe('<p>pasted</p>');
  });
});
