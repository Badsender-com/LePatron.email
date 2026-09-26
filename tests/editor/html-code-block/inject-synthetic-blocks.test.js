'use strict';

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const {
  injectSyntheticBlocks,
  orderPaletteBlockDefs,
} = require('../../../packages/editor/src/js/ext/html-code-block/inject-synthetic-blocks.js');
const {
  HTML_CODE_BLOCK_TYPE,
} = require('../../../packages/editor/src/js/ext/html-code-block/constants.js');
const {
  SYNTHETIC_BLOCKS,
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
} = require('../../../packages/editor/src/js/ext/html-code-block/block-types.js');

// A block's opening tag, as the injector emits it.
const openingTagOf = (descriptor) =>
  `<div class="${descriptor.rootClass}" data-ko-block="${descriptor.type}">`;

const BLOCK_OPEN = openingTagOf(HTML_CODE_BLOCK);

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// Every template shipped with the repo, so the injector is exercised against
// real-world markup rather than hand-written snippets only.
const FIXTURES = [
  'template-example/versafix-1/template-versafix-1.html',
  'template-example/tedc15/template-tedc15.html',
  'template-example/sub-themes/template-sub-themes.html',
  'template-example/tutorial/template-tutorial.html',
  'template-example/tutorial-badsender/template-tutorial.html',
  'packages/editor/spec/data/template-versafix-1.html',
];

const readFixture = (relative) =>
  fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

const MINIMAL_TEMPLATE = [
  '<html>',
  '<head><style type="text/css">@supports -ko-blockdefs { text { widget: text; } }</style></head>',
  '<body><div data-ko-container="main"><div data-ko-block="textBlock"></div></div></body>',
  '</html>',
].join('\n');

describe('injectSyntheticBlocks', () => {
  describe.each(FIXTURES)('on %s', (relative) => {
    let source;
    let injected;

    beforeAll(() => {
      source = readFixture(relative);
      injected = injectSyntheticBlocks(source);
    });

    it('injects the block definition and its markup', () => {
      expect(injected).not.toBe(source);
      expect(injected).toContain(`data-ko-block="${HTML_CODE_BLOCK_TYPE}"`);
      expect(injected).toContain(`${HTML_CODE_BLOCK_TYPE} { label:`);
    });

    it('is idempotent', () => {
      expect(injectSyntheticBlocks(injected)).toBe(injected);
    });

    it('inserts the markup inside the drag-and-drop container', () => {
      const containerMatch = /<[^>]*data-ko-container[^>]*>/i.exec(injected);
      const blockIndex = injected.indexOf(
        `data-ko-block="${HTML_CODE_BLOCK_TYPE}"`
      );
      expect(containerMatch.index).toBeLessThan(blockIndex);
    });

    it('leaves the rest of the markup byte-for-byte identical', () => {
      const withoutBlock = removeInjectedBlock(injected);
      expect(removeInjectedStyle(withoutBlock)).toBe(source);
    });

    // The template is fetched and preprocessed on every editor load; a
    // backtracking pattern here froze the editor on large templates.
    it('runs in well under a second', () => {
      const start = Date.now();
      injectSyntheticBlocks(source);
      expect(Date.now() - start).toBeLessThan(500);
    });
  });

  it('injects into a minimal template', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    expect(result).toContain(`data-ko-block="${HTML_CODE_BLOCK_TYPE}"`);
    expect(result).toContain('widget: code');
  });

  it('places the markup right after the container opening tag', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    expect(result).toContain(`<div data-ko-container="main">${BLOCK_OPEN}`);
  });

  it('puts the block definitions before </head>', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    const defsIndex = result.indexOf(`${HTML_CODE_BLOCK_TYPE} { label:`);
    expect(defsIndex).toBeGreaterThan(-1);
    expect(defsIndex).toBeLessThan(result.indexOf('</head>'));
  });

  it('marks the pasted-markup holder with the CSS class, not a data-* attribute', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    expect(result).toContain('class="lp-html-block"');
    expect(result).not.toContain('data-lp-html-block');
  });

  // data-ko-display must sit on a descendant: a scoped jQuery selector would not
  // match the block root, and the attribute would leak into the export.
  it('keeps data-ko-display off the block root', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    const root = /<div[^>]*data-ko-block="htmlCodeBlock"[^>]*>/.exec(result);
    expect(root[0]).not.toContain('data-ko-display');
    expect(result).toContain('data-ko-display="htmlCode"');
  });

  // TinyMCE would attach to a data-ko-editable field and rewrite the markup.
  it('never uses data-ko-editable', () => {
    const result = injectSyntheticBlocks(MINIMAL_TEMPLATE);
    const block = result.slice(result.indexOf(BLOCK_OPEN));
    expect(block).not.toContain('data-ko-editable');
  });

  describe('when it cannot inject safely', () => {
    it('leaves markup without a container untouched', () => {
      const markup = '<html><head></head><body><div></div></body></html>';
      expect(injectSyntheticBlocks(markup)).toBe(markup);
    });

    it('leaves markup without a closing head untouched', () => {
      const markup =
        '<html><body><div data-ko-container="main"></div></body></html>';
      expect(injectSyntheticBlocks(markup)).toBe(markup);
    });

    it('does not inject twice when a template ships its own block', () => {
      const markup = MINIMAL_TEMPLATE.replace(
        'data-ko-block="textBlock"',
        `data-ko-block="${HTML_CODE_BLOCK_TYPE}"`
      );
      expect(injectSyntheticBlocks(markup)).toBe(markup);
    });

    it('passes through empty and non-string input', () => {
      expect(injectSyntheticBlocks('')).toBe('');
      expect(injectSyntheticBlocks(null)).toBeNull();
      expect(injectSyntheticBlocks(undefined)).toBeUndefined();
    });
  });

  it('is not fooled by a ">" inside an attribute value of the container tag', () => {
    const markup = [
      '<html><head></head><body>',
      '<div style="font: a > b" data-ko-container="main">',
      '<div data-ko-block="textBlock"></div></div></body></html>',
    ].join('');
    const result = injectSyntheticBlocks(markup);
    // The block must land after the full opening tag, not in the middle of it.
    expect(result).toContain(
      `<div style="font: a > b" data-ko-container="main">${BLOCK_OPEN}`
    );
  });

  it('prefers the main container when several are present', () => {
    const markup = [
      '<html><head></head><body>',
      '<div data-ko-container="preheader"></div>',
      '<div data-ko-container="main"></div>',
      '</body></html>',
    ].join('');
    const result = injectSyntheticBlocks(markup);
    expect(result).toContain(`<div data-ko-container="main">${BLOCK_OPEN}`);
    expect(result).toContain('<div data-ko-container="preheader"></div>');
  });
});

describe('orderPaletteBlockDefs', () => {
  const textBlock = { type: 'textBlock' };
  const imageBlock = { type: 'imageBlock' };
  const htmlBlock = { type: HTML_CODE_BLOCK.type };
  const builderBlock = { type: BLOCK_BUILDER_BLOCK.type };

  const both = { htmlBlockEnabled: true, blockBuilderEnabled: true };

  it('drops both synthetic blocks when neither flag is on', () => {
    const result = orderPaletteBlockDefs(
      [textBlock, htmlBlock, builderBlock, imageBlock],
      {}
    );
    expect(result).toEqual([textBlock, imageBlock]);
  });

  it('moves the enabled blocks to the very end', () => {
    const result = orderPaletteBlockDefs(
      [htmlBlock, textBlock, builderBlock, imageBlock],
      both
    );
    expect(result).toEqual([textBlock, imageBlock, htmlBlock, builderBlock]);
  });

  // The whole point of two flags: a client can be given the builder and its
  // guard rails without being handed responsibility for raw HTML.
  it('shows the builder alone when only its flag is on', () => {
    const result = orderPaletteBlockDefs([htmlBlock, builderBlock, textBlock], {
      blockBuilderEnabled: true,
    });
    expect(result).toEqual([textBlock, builderBlock]);
  });

  it('shows the HTML block alone when only its flag is on', () => {
    const result = orderPaletteBlockDefs([htmlBlock, builderBlock, textBlock], {
      htmlBlockEnabled: true,
    });
    expect(result).toEqual([textBlock, htmlBlock]);
  });

  // Declaration order, so the palette reads the same in every template whatever
  // order the definitions came back in.
  it('orders the synthetic blocks the same way regardless of input order', () => {
    const result = orderPaletteBlockDefs([builderBlock, htmlBlock], both);
    expect(result).toEqual([htmlBlock, builderBlock]);
  });

  // A real observable, not a bare function: ko.utils.unwrapObservable only
  // unwraps things ko.isObservable recognises.
  it('unwraps an observable type', () => {
    const observableTyped = { type: ko.observable(HTML_CODE_BLOCK_TYPE) };
    const result = orderPaletteBlockDefs([observableTyped, textBlock], {});
    expect(result).toEqual([textBlock]);
  });

  it('never mutates the input array', () => {
    const input = [htmlBlock, textBlock];
    orderPaletteBlockDefs(input, both);
    expect(input).toEqual([htmlBlock, textBlock]);
  });

  it('tolerates a template that has no synthetic block at all', () => {
    expect(orderPaletteBlockDefs([textBlock], both)).toEqual([textBlock]);
    expect(orderPaletteBlockDefs([], both)).toEqual([]);
  });

  it('tolerates null entries, missing metadata and a non-array input', () => {
    expect(orderPaletteBlockDefs([null, textBlock], both)).toEqual([
      null,
      textBlock,
    ]);
    expect(orderPaletteBlockDefs([htmlBlock, textBlock], null)).toEqual([
      textBlock,
    ]);
    expect(orderPaletteBlockDefs(undefined, both)).toBeUndefined();
  });
});

const INJECTED_BLOCK_CLOSING = '</div></div>';

// Every synthetic block, not just the first: the injector emits one per
// descriptor, and leaving one behind would let this test pass while the
// template gained markup nobody checked.
function removeInjectedBlock(markup) {
  return SYNTHETIC_BLOCKS.reduce((rest, descriptor) => {
    // Anchor on that block's exact opening tag; real templates are full of
    // <div>s of their own.
    const start = rest.indexOf(openingTagOf(descriptor));
    expect(start).toBeGreaterThan(-1);
    const end =
      rest.indexOf(INJECTED_BLOCK_CLOSING, start) +
      INJECTED_BLOCK_CLOSING.length;
    return rest.slice(0, start) + rest.slice(end);
  }, markup);
}

function removeInjectedStyle(markup) {
  const start = markup.indexOf(
    '<style type="text/css">\n@supports -ko-blockdefs {'
  );
  const end = markup.indexOf('</style>', start) + '</style>'.length;
  return markup.slice(0, start) + markup.slice(end);
}
