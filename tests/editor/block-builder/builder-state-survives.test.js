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
  injectHtmlCodeBlock,
} = require('../../../packages/editor/src/js/ext/html-code-block/inject-html-code-block.js');
const {
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
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
    markStructuralTags(injectHtmlCodeBlock(TEMPLATE)),
    () => null,
    (html, name, mode) => (name && mode ? `${name}-${mode}` : name || 'anon')
  );
});

/** The model Mosaico generates for one HTML code block. */
const generatedBlock = () =>
  modelDef.generateModel(templateDef._defs, HTML_CODE_BLOCK_TYPE);

/**
 * checkModel as the editor calls it (template-loader.js): the GENERATED model
 * first, the STORED content third. Getting that order wrong tests nothing.
 */
const check = (stored) =>
  converter.checkModel(generatedBlock(), templateDef._defs, stored);

describe('the block definitions', () => {
  it('declare the builder state alongside the pasted markup', () => {
    const block = generatedBlock();

    expect(block).toHaveProperty(HTML_CODE_PROPERTY);
    expect(block).toHaveProperty(BUILDER_STATE_PROPERTY);
  });

  // The default every property gets, and the reason a stored string is safe.
  it('generates it as null, like every other property', () => {
    expect(generatedBlock()[BUILDER_STATE_PROPERTY]).toBeNull();
    expect(generatedBlock()[HTML_CODE_PROPERTY]).toBeNull();
  });
});

describe('checkModel', () => {
  const stored = (extra) => ({
    type: HTML_CODE_BLOCK_TYPE,
    [HTML_CODE_PROPERTY]: '<p>generated</p>',
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

  // Every mailing written before this commit is in exactly this state.
  it('accepts a block stored before the state existed', () => {
    const content = stored();

    expect(check(content)).toBeLessThan(2);
    expect(content[HTML_CODE_PROPERTY]).toBe('<p>generated</p>');
  });
});
