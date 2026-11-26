'use strict';

// The head CSS follows the HTML code blocks, not the template flag: exported
// while the mailing holds at least one, left out of the export once none is
// left — and kept, so an undo or a block added back gets it back as it was.
//
// Before this rule the CSS was exported whenever it was stored, so deleting the
// last block left a stylesheet styling nothing in every export.

// The bundle aliases this name to ko-reactor (package.json aliasify), which
// registers `ko.watch` instead of exporting it; undomanager.js falls back to it.
jest.mock(
  'knockoutjs-reactor',
  () => {
    require('ko-reactor/dist/ko-reactor.js');
    return {};
  },
  { virtual: true }
);

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const {
  hasHtmlCodeBlock,
  headCssToExport,
} = require('../../../packages/editor/src/js/ext/head-css/exported-css.js');
const {
  addHeadCssToViewModel,
} = require('../../../packages/editor/src/js/ext/head-css/view-model.js');
const addUndoStackExtensionMaker = require('../../../packages/editor/src/js/undomanager/undomain.js');
const {
  injectHeadCss,
} = require('../../../packages/shared/head-css/inject-head-css.js');
const serverExport = require('../../../packages/server/mailing/head-css-export.js');

const CSS = '.classred{color:red}';
const DOC =
  '<!DOCTYPE html><html><head><title>t</title></head><body></body></html>';

const htmlBlock = () => ({ type: 'htmlCodeBlock', htmlCode: '<p>x</p>' });
const textBlock = () => ({ type: 'textBlock', text: 'Hello' });
const builderBlock = () => ({
  type: 'blockBuilderBlock',
  builderHtml: '<p>x</p>',
});
// A composed block whose two columns derive a stacking rule.
const composedBlock = () => ({
  type: 'blockBuilderBlock',
  builderHtml: '<p>x</p>',
  builderState: JSON.stringify({
    v: 2,
    gen: '1.0.0',
    rows: [
      {
        id: 'r1',
        columns: [
          { width: 50, elements: [{ id: 'e1', type: 'text', content: 'a' }] },
          { width: 50, elements: [{ id: 'e2', type: 'text', content: 'b' }] },
        ],
      },
    ],
  }),
});

// The shape Mosaico gives the content once instrumented: every level an
// observable, `type` included (see synthetic-blocks/block-state.js).
function field(value, name) {
  const observable = Array.isArray(value)
    ? ko.observableArray(value)
    : ko.observable(value);
  observable._fieldName = name;
  return observable;
}
function wrapBlock(block, index) {
  const wrapped = {};
  Object.keys(block).forEach((key) => {
    wrapped[key] = field(block[key], key);
  });
  return field(wrapped, String(index));
}
function wrapModel(containers) {
  const model = { type: field('template', 'type') };
  Object.keys(containers).forEach((name) => {
    const blocks = field(containers[name].map(wrapBlock), 'blocks');
    model[name] = field({ blocks }, name);
  });
  return ko.observable(model);
}

/** An editor view model with the head CSS members and its undo stack. */
function makeEditor({ blocks, htmlBlockEnabled }) {
  const viewModel = {
    content: wrapModel({ mainBlocks: blocks }),
    contentListeners: ko.observable(0),
    t: (key) => key,
    metadata: { htmlBlockEnabled },
  };
  addHeadCssToViewModel(viewModel);
  viewModel.headCss(CSS);
  const undo = addUndoStackExtensionMaker((_label, fn, ...args) => fn(...args))(
    viewModel
  );
  undo.init();
  const mainBlocks = () => viewModel.content().mainBlocks().blocks;
  // What exportHTML returns, past every step before the injection.
  const exported = () => injectHeadCss(DOC, viewModel.exportedHeadCss());
  return { viewModel, mainBlocks, exported, dispose: undo.dispose };
}

describe('hasHtmlCodeBlock', () => {
  it('finds a block in mainBlocks', () => {
    expect(hasHtmlCodeBlock({ mainBlocks: { blocks: [htmlBlock()] } })).toBe(
      true
    );
  });

  // A template may declare other containers: one of them must not hide the
  // block, as it would not hide it from the server.
  it('finds a block in any top-level container', () => {
    expect(
      hasHtmlCodeBlock({
        mainBlocks: { blocks: [textBlock()] },
        footerBlocks: { blocks: [htmlBlock()] },
      })
    ).toBe(true);
  });

  it('counts an empty block, as the server does', () => {
    expect(
      hasHtmlCodeBlock({
        mainBlocks: { blocks: [{ type: 'htmlCodeBlock', htmlCode: '' }] },
      })
    ).toBe(true);
  });

  it('is false without any', () => {
    expect(hasHtmlCodeBlock({ mainBlocks: { blocks: [textBlock()] } })).toBe(
      false
    );
    expect(hasHtmlCodeBlock({ mainBlocks: { blocks: [] } })).toBe(false);
    expect(hasHtmlCodeBlock({ titleText: 'htmlCodeBlock' })).toBe(false);
    expect(hasHtmlCodeBlock(null)).toBe(false);
    expect(hasHtmlCodeBlock(undefined)).toBe(false);
  });

  // The builder's block writes its own styles inline: it has nothing for the
  // head CSS to style, so it does not keep it exported.
  it('does not count the block builder', () => {
    expect(hasHtmlCodeBlock({ mainBlocks: { blocks: [builderBlock()] } })).toBe(
      false
    );
    expect(hasHtmlCodeBlock(wrapModel({ mainBlocks: [builderBlock()] }))).toBe(
      false
    );
  });

  it('reads the instrumented model the editor holds', () => {
    expect(hasHtmlCodeBlock(wrapModel({ mainBlocks: [htmlBlock()] }))).toBe(
      true
    );
    expect(hasHtmlCodeBlock(wrapModel({ mainBlocks: [textBlock()] }))).toBe(
      false
    );
  });
});

describe('headCssToExport', () => {
  it('is the stored CSS while a block is present, nothing otherwise', () => {
    const withBlock = { mainBlocks: { blocks: [htmlBlock()] } };
    const without = { mainBlocks: { blocks: [textBlock()] } };
    expect(headCssToExport(withBlock, CSS)).toBe(CSS);
    expect(headCssToExport(without, CSS)).toBe('');
    expect(headCssToExport(withBlock, '')).toBe('');
    expect(headCssToExport(withBlock, undefined)).toBe('');
  });
});

describe('the exported head CSS', () => {
  it.each([
    ['on', true],
    ['off', false],
  ])(
    'is injected while an HTML code block is present, flag %s',
    (_label, htmlBlockEnabled) => {
      const { exported } = makeEditor({
        blocks: [textBlock(), htmlBlock()],
        htmlBlockEnabled,
      });
      expect(exported()).toContain('="true">' + CSS + '</style></head>');
    }
  );

  it('is not injected without any HTML code block', () => {
    const { exported } = makeEditor({
      blocks: [textBlock()],
      htmlBlockEnabled: true,
    });
    // The very same string: an export without the block is untouched.
    expect(exported()).toBe(DOC);
  });

  it('is kept, not erased, once the last block is removed', () => {
    const { viewModel, mainBlocks, exported } = makeEditor({
      blocks: [textBlock(), htmlBlock()],
      htmlBlockEnabled: true,
    });

    mainBlocks().splice(1, 1);

    expect(exported()).toBe(DOC);
    expect(viewModel.headCss()).toBe(CSS);
  });

  it('comes back with an undo of the removal', () => {
    const { viewModel, mainBlocks, exported } = makeEditor({
      blocks: [textBlock(), htmlBlock()],
      htmlBlockEnabled: true,
    });
    mainBlocks().splice(1, 1);

    viewModel.undo.execute();

    expect(mainBlocks()()).toHaveLength(2);
    expect(exported()).toContain(CSS + '</style></head>');
  });

  it('comes back when a block is added again', () => {
    const { mainBlocks, exported } = makeEditor({
      blocks: [textBlock(), htmlBlock()],
      htmlBlockEnabled: true,
    });
    mainBlocks().splice(1, 1);

    mainBlocks().push(wrapBlock(htmlBlock(), 1));

    expect(exported()).toContain(CSS + '</style></head>');
  });
});

// The server writes stored copies itself (a translated duplicate's previewHtml)
// and must decide as the editor's export does. The rule is shared; what each
// side does on its own is collect its inputs, from different shapes —
// instrumented here, plain there — so the two are pinned to agree.
describe('the server counterpart', () => {
  const IMPORT = '@import url(a.css);';
  const cases = [
    ['a block in mainBlocks', { mainBlocks: [htmlBlock()] }, CSS],
    [
      'a block in another container',
      { mainBlocks: [], footerBlocks: [htmlBlock()] },
      CSS,
    ],
    [
      'an empty block',
      { mainBlocks: [{ type: 'htmlCodeBlock', htmlCode: '' }] },
      CSS,
    ],
    ['no block', { mainBlocks: [textBlock()] }, CSS],
    ['a builder block with no state', { mainBlocks: [builderBlock()] }, CSS],
    ['a composed block alone', { mainBlocks: [composedBlock()] }, ''],
    [
      'author CSS and a composed block, no HTML code block',
      { mainBlocks: [composedBlock(), textBlock()] },
      CSS,
    ],
    [
      'author CSS, an HTML code block and no composed block',
      { mainBlocks: [htmlBlock(), textBlock()] },
      IMPORT + CSS,
    ],
    [
      'both blocks, in different containers',
      { mainBlocks: [composedBlock()], footerBlocks: [htmlBlock()] },
      IMPORT + CSS,
    ],
  ];

  const plain = (containers) =>
    Object.keys(containers).reduce((model, name) => {
      model[name] = { blocks: containers[name] };
      return model;
    }, {});

  it.each(cases)('agrees on %s', (_label, containers, css) => {
    const data = plain(containers);
    const onTheServer = serverExport.headCssToExport({ data, headCss: css });

    expect(headCssToExport(data, css)).toBe(onTheServer);
    // And on the model the editor actually holds.
    expect(headCssToExport(wrapModel(containers), css)).toBe(onTheServer);
  });

  it('agrees on a stylesheet with something in it', () => {
    // Two empty strings agree too: at least one case must carry both sources.
    const data = plain({ mainBlocks: [composedBlock(), htmlBlock()] });
    const onTheServer = serverExport.headCssToExport({ data, headCss: CSS });

    expect(onTheServer).toContain('.lp-stack{');
    expect(onTheServer).toContain(CSS);
  });

  it.each([
    ['no container', { titleText: 'htmlCodeBlock' }],
    ['no content', undefined],
  ])('agrees on %s', (_label, data) => {
    expect(serverExport.headCssToExport({ data, headCss: CSS })).toBe(
      headCssToExport(data, CSS)
    );
  });
});

// exportHTML cannot run outside a browser with a bound template: what is pinned
// here is that it injects the exported CSS, not the stored one.
describe('exportHTML', () => {
  it('injects the CSS the rule lets through', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../../packages/editor/src/js/viewmodel.js'),
      'utf8'
    );
    expect(source).toContain(
      'return injectHeadCss(content, viewModel.exportedHeadCss());'
    );
    expect(source).not.toContain('injectHeadCss(content, viewModel.headCss())');
  });
});
