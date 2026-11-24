/**
 * @jest-environment jsdom
 */

'use strict';

// The canvas preview exists so writing a rule shows its effect where the email
// is composed. Two things must hold: the rules never escape the canvas into the
// editor's own chrome, and the preview never becomes the source of truth — the
// export injects the CSS verbatim, and is unaffected by anything here.

const ko = require('knockout');

const {
  attachHeadCssPreview,
  headCssPreviewPlugin,
  STYLE_ELEMENT_ID,
} = require('../../../packages/editor/src/js/ext/head-css/canvas-preview.js');
const {
  ALWAYS_TRUE_MEDIA,
  VISIBLE_ON_BOTH_SUFFIX,
} = require('../../../packages/editor/src/js/ext/preview-media.js');

const {
  addHeadCssToViewModel,
} = require('../../../packages/editor/src/js/ext/head-css/view-model.js');

const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');

const htmlCodeBlock = () =>
  ko.observable({ type: ko.observable('htmlCodeBlock') });
const textBlock = () => ko.observable({ type: ko.observable('textBlock') });

// A composition of one row of two columns, which stacks on a phone.
const TWO_COLUMNS = {
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
};
const composedBlock = () =>
  ko.observable({
    type: ko.observable('blockBuilderBlock'),
    builderHtml: ko.observable(generate(TWO_COLUMNS)),
    builderState: ko.observable(JSON.stringify(TWO_COLUMNS)),
  });

// A view model carrying the head CSS members, over a content model holding an
// HTML code block unless told otherwise: the canvas shows the CSS only when
// the export would carry it (exported-css.js).
function makeViewModel(css, { previewMode, blocks } = {}) {
  const mainBlocks = ko.observableArray(blocks || [htmlCodeBlock()]);
  const viewModel = {
    content: ko.observable({
      mainBlocks: ko.observable({ blocks: mainBlocks }),
    }),
    metadata: { htmlBlockEnabled: true },
  };
  addHeadCssToViewModel(viewModel);
  viewModel.headCss(css || '');
  if (previewMode !== null) {
    viewModel.previewMode = ko.observable(previewMode || 'desktop');
  }
  return { viewModel, mainBlocks };
}

function setup(initialCss, previewMode) {
  const { viewModel } = makeViewModel(initialCss, { previewMode });
  const subscription = attachHeadCssPreview(viewModel, document);
  return {
    viewModel,
    subscription,
    sheet: () => document.getElementById(STYLE_ELEMENT_ID),
  };
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('attachHeadCssPreview', () => {
  it('scopes the stylesheet to the canvas', () => {
    const { sheet } = setup('.classred{color:red}');

    expect(sheet().textContent).toContain('#main-wysiwyg-area .classred');
    // The bare selector must not be there on its own.
    expect(sheet().textContent).not.toMatch(/(^|})\s*\.classred/);
  });

  it('follows later edits', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    viewModel.headCss('.b{color:blue}');

    expect(sheet().textContent).toContain('#main-wysiwyg-area .b');
    expect(sheet().textContent).not.toContain('.a');
  });

  it('reuses one style element rather than stacking them', () => {
    const { viewModel } = setup('.a{color:red}');

    viewModel.headCss('.b{color:blue}');
    viewModel.headCss('.c{color:green}');

    expect(document.querySelectorAll('style').length).toBe(1);
  });

  it('clears the canvas when the CSS is emptied', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    viewModel.headCss('');

    expect(sheet().textContent).toBe('');
  });

  // Half-typed CSS is the normal state while editing: it must style what it
  // can, still scoped, and never throw.
  it('survives a stylesheet in the middle of being typed', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    expect(() => viewModel.headCss('.b{color:')).not.toThrow();
    expect(sheet().textContent).toContain('#main-wysiwyg-area .b');
  });

  it('does not throw on a document with no head', () => {
    const {
      renderPreview,
    } = require('../../../packages/editor/src/js/ext/head-css/canvas-preview.js');
    expect(() => renderPreview({}, '.a{color:red}')).not.toThrow();
  });

  describe('the mobile toggle', () => {
    const MEDIA = '@media (max-width:600px){.a{width:100%}}';

    it('keeps the condition in desktop preview', () => {
      const { sheet } = setup(MEDIA, 'desktop');
      expect(sheet().textContent).toContain('@media (max-width:600px)');
    });

    it('neutralises it when switching to mobile', () => {
      const { viewModel, sheet } = setup(MEDIA, 'desktop');

      viewModel.previewMode('mobile');

      expect(sheet().textContent).toContain('min-width: 0px');
      expect(sheet().textContent).not.toContain('max-width:600px');
    });

    it('restores it when switching back', () => {
      const { viewModel, sheet } = setup(MEDIA, 'mobile');

      viewModel.previewMode('desktop');

      expect(sheet().textContent).toContain('@media (max-width:600px)');
    });

    // The default mode treats the template's media queries this way too
    // (badsender-screen-preview.js): forced, with selectors no element matches.
    it('follows the template in the default `both` mode', () => {
      const { sheet } = setup(MEDIA, 'both');

      expect(sheet().textContent).toContain(ALWAYS_TRUE_MEDIA);
      expect(sheet().textContent).toContain(
        '#main-wysiwyg-area .a' + VISIBLE_ON_BOTH_SUFFIX
      );
    });
  });

  it('works without a previewMode observable', () => {
    const { viewModel } = makeViewModel('.a{color:red}', { previewMode: null });
    expect(() => attachHeadCssPreview(viewModel, document)).not.toThrow();
    expect(document.getElementById(STYLE_ELEMENT_ID).textContent).toContain(
      '#main-wysiwyg-area .a'
    );
  });

  // template-loader.js disposes its plugins when the editor is torn down: the
  // subscriptions must not outlive the view model, nor its rules the editor.
  describe('as an editor plugin', () => {
    it('starts on init and stops on dispose', () => {
      const { viewModel, mainBlocks } = makeViewModel('.a{color:red}');
      const plugin = headCssPreviewPlugin(viewModel);

      expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
      plugin.init();
      expect(document.getElementById(STYLE_ELEMENT_ID).textContent).toContain(
        '#main-wysiwyg-area .a'
      );

      plugin.dispose();
      expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
      expect(viewModel.headCss.getSubscriptionsCount()).toBe(0);
      expect(viewModel.previewMode.getSubscriptionsCount()).toBe(0);
      expect(mainBlocks.getSubscriptionsCount()).toBe(0);

      viewModel.headCss('.b{color:blue}');
      expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    });

    it('tolerates a dispose without init', () => {
      expect(() => headCssPreviewPlugin({}).dispose()).not.toThrow();
    });
  });

  // The canvas must show the email that will be sent: the CSS follows the HTML
  // code blocks, exactly as the export does.
  describe('the HTML code block rule', () => {
    it('shows nothing while the mailing holds no HTML code block', () => {
      const { viewModel } = makeViewModel('.a{color:red}', {
        blocks: [textBlock()],
      });
      attachHeadCssPreview(viewModel, document);

      expect(document.getElementById(STYLE_ELEMENT_ID).textContent).toBe('');
    });

    it('shows it once a block is added, and drops it once removed', () => {
      const { viewModel, mainBlocks } = makeViewModel('.a{color:red}', {
        blocks: [textBlock()],
      });
      attachHeadCssPreview(viewModel, document);
      const sheet = () => document.getElementById(STYLE_ELEMENT_ID);

      mainBlocks.push(htmlCodeBlock());
      expect(sheet().textContent).toContain('#main-wysiwyg-area .a');

      mainBlocks.splice(1, 1);
      expect(sheet().textContent).toBe('');
      // Kept, so a block added back gets it back.
      expect(viewModel.headCss()).toBe('.a{color:red}');
    });

    it('shows it with the template flag off, while a block is present', () => {
      const { viewModel } = makeViewModel('.a{color:red}');
      viewModel.metadata.htmlBlockEnabled = false;
      attachHeadCssPreview(viewModel, document);

      expect(document.getElementById(STYLE_ELEMENT_ID).textContent).toContain(
        '#main-wysiwyg-area .a'
      );
    });

    it('does not re-render on a content edit that changes nothing', () => {
      const { viewModel, mainBlocks } = makeViewModel('.a{color:red}');
      attachHeadCssPreview(viewModel, document);
      const sheet = document.getElementById(STYLE_ELEMENT_ID);
      sheet.textContent = 'untouched';

      mainBlocks.push(textBlock());

      expect(sheet.textContent).toBe('untouched');
    });
  });

  // The stacking rule only means anything inside its media query, so the
  // canvas has to follow the preview toggle for it as it does for the
  // template's own rules: stacked on mobile, side by side on desktop.
  describe('a composed block in two columns', () => {
    // The canvas, holding the block's markup as the editor shows it.
    function canvasWithComposedBlock(previewMode) {
      document.body.innerHTML = `<div id="main-wysiwyg-area">${generate(
        TWO_COLUMNS
      )}</div>`;
      const { viewModel } = makeViewModel('', {
        previewMode,
        blocks: [composedBlock()],
      });
      attachHeadCssPreview(viewModel, document);
      const sheet = document.getElementById(STYLE_ELEMENT_ID);
      const cells = [
        ...document.querySelectorAll('#main-wysiwyg-area td.lp-stack'),
      ];
      return { viewModel, sheet, cells };
    }

    // The selector of the one stacking rule, as scoped for the canvas.
    const stackingSelector = (sheet) => {
      const match = sheet.textContent.match(/([^{}]*\.lp-stack[^{}]*)\{/);
      return match ? match[1].trim() : null;
    };

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('keeps the rule behind its width condition on desktop', () => {
      const { sheet } = canvasWithComposedBlock('desktop');

      expect(sheet.textContent).toMatch(/max-width:\s*600px/);
      expect(sheet.textContent).not.toContain(ALWAYS_TRUE_MEDIA);
    });

    it('forces the rule on mobile, onto the cells the canvas shows', () => {
      const { sheet, cells } = canvasWithComposedBlock('mobile');

      expect(sheet.textContent).toContain(ALWAYS_TRUE_MEDIA);
      expect(sheet.textContent).not.toMatch(/max-width:\s*600px/);
      expect(sheet.textContent).toMatch(/display:\s*block\s*!important/);
      expect(cells).toHaveLength(2);
      cells.forEach((cell) =>
        expect(cell.matches(stackingSelector(sheet))).toBe(true)
      );
    });

    it('follows the toggle back and forth', () => {
      const { viewModel, sheet } = canvasWithComposedBlock('desktop');

      viewModel.previewMode('mobile');
      expect(sheet.textContent).toContain(ALWAYS_TRUE_MEDIA);

      viewModel.previewMode('desktop');
      expect(sheet.textContent).toMatch(/max-width:\s*600px/);
    });

    // The editor's default mode treats the template's own media queries the
    // same way: forced, onto selectors no element carries. So the columns do
    // not stack there; only the mobile preview shows them stacked.
    it('does not stack in the default `both` mode', () => {
      const { sheet, cells } = canvasWithComposedBlock('both');

      expect(sheet.textContent).toContain(ALWAYS_TRUE_MEDIA);
      expect(stackingSelector(sheet)).toContain(VISIBLE_ON_BOTH_SUFFIX);
      cells.forEach((cell) =>
        expect(cell.matches(stackingSelector(sheet))).toBe(false)
      );
    });
  });

  // The author's `@charset` and `@import` are kept above the derived rules in
  // the export; the canvas leaves them out altogether, and keeps the rest
  // scoped.
  it('scopes the author rules after an @import, next to the derived ones', () => {
    const {
      viewModel,
    } = makeViewModel(
      '@charset "utf-8";\n@import url(a.css);\n.classred{color:red}',
      { previewMode: 'desktop', blocks: [composedBlock(), htmlCodeBlock()] }
    );
    attachHeadCssPreview(viewModel, document);
    const text = document.getElementById(STYLE_ELEMENT_ID).textContent;

    expect(text).not.toContain('@import');
    expect(text).not.toContain('@charset');
    expect(text).toContain('#main-wysiwyg-area .lp-stack');
    expect(text).toContain('#main-wysiwyg-area .classred');
    expect(text.indexOf('.lp-stack')).toBeLessThan(text.indexOf('.classred'));
  });

  it('does nothing without the head CSS members', () => {
    expect(attachHeadCssPreview({}, document)).toBeNull();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
  });
});
