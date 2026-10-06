/**
 * @jest-environment jsdom
 */

'use strict';

// Runs the REAL Mosaico converter over a template the injector has just
// processed, then inspects the `-show` template — the one the export resolves
// (`type + '-show'`, see bindings/blocks.js). This is what pins down the markup a
// mail actually ships, rather than the markup we think we injected.

const jQuery = require('jquery');
const ko = require('knockout');

global.$ = global.jQuery = jQuery;
global.ko = ko;

const {
  injectHtmlCodeBlock,
} = require('../../../packages/editor/src/js/ext/html-code-block/inject-html-code-block.js');
const {
  stripEmptyHtmlCodeBlocks,
} = require('../../../packages/editor/src/js/ext/html-code-block/strip-empty-blocks.js');
const converter = require('../../../packages/editor/src/js/converter/main.js');

const BARE_TEMPLATE = [
  '<html><head><style type="text/css">@supports -ko-blockdefs {',
  '  text { label: Text; widget: text; }',
  '}</style></head>',
  '<body><div data-ko-container="main" data-ko-wrap="false"></div></body></html>',
].join('');

// A template with a block of its own, to check the injection changes nothing for it.
const TEMPLATE_WITH_NATIVE_BLOCK = [
  '<html><head><style type="text/css">@supports -ko-blockdefs {',
  '  text { label: Text; widget: text; }',
  '  textBlock { label: Text Block; properties: text; }',
  '}</style></head>',
  '<body><div data-ko-container="main" data-ko-wrap="false">',
  '<table class="vb-outer" width="100%" data-ko-block="textBlock">',
  '<tr><td align="center" valign="top"><div data-ko-editable="text">Hello</div></td></tr>',
  '</table>',
  '</div></body></html>',
].join('');

// Mosaico replaces html/head/body before parsing so jQuery does not swallow them.
const markStructuralTags = (html) =>
  html.replace(
    /(<\/?)(html|head|body)([^>]*>)/gi,
    (match, open, tag, rest) => open + 'replaced' + tag + rest
  );

/**
 * Compile a template and return every generated Knockout template by name.
 */
function compile(templateHtml) {
  const templates = {};
  const templateCreator = (htmlOrElement, optionalName, templateMode) => {
    let name = optionalName;
    if (optionalName && templateMode) name = optionalName + '-' + templateMode;
    if (!name) name = 'anonymous-' + Object.keys(templates).length;
    templates[name] =
      typeof htmlOrElement === 'object'
        ? htmlOrElement.outerHTML
        : htmlOrElement;
    return name;
  };
  converter.translateTemplate(
    'template',
    markStructuralTags(templateHtml),
    () => null,
    templateCreator
  );
  return templates;
}

let showTemplate;

beforeAll(() => {
  showTemplate = compile(injectHtmlCodeBlock(BARE_TEMPLATE))[
    'htmlCodeBlock-show'
  ];
});

describe('the exported markup of an HTML code block', () => {
  it('produces a -show template at all', () => {
    expect(showTemplate).toBeTruthy();
  });

  // Correction 1: the wrapper must not set an alignment context of its own.
  // `align` maps to `text-align`, which IS inherited, so an align="left" on the
  // wrapper overrode the alignment the pasted markup inherits from the template
  // and stopped a table pasted with align="center" from centering.
  describe('carries no presentation of its own', () => {
    it('has no align attribute', () => {
      expect(showTemplate).not.toMatch(/\balign=/i);
    });

    it('has no valign attribute', () => {
      expect(showTemplate).not.toMatch(/\bvalign=/i);
    });

    it('introduces no table, row or cell', () => {
      expect(showTemplate).not.toMatch(/<table/i);
      expect(showTemplate).not.toMatch(/<tr/i);
      expect(showTemplate).not.toMatch(/<td/i);
    });

    it('sets no width, background or inline style', () => {
      expect(showTemplate).not.toMatch(/\bwidth=/i);
      expect(showTemplate).not.toMatch(/\bbgcolor=/i);
      expect(showTemplate).not.toMatch(/\bstyle=/i);
    });

    // .vb-outer and friends are styled by the template's own CSS; the root
    // carries only our unstyled hook, used to strip an empty block on export.
    it('puts no styled template class on the root', () => {
      const root = /^<div[^>]*>/.exec(showTemplate)[0];
      expect(root).toContain('class="lp-html-block-root"');
      expect(root).not.toMatch(/vb-outer|vb-row|vb-content/);
    });
  });

  // Correction 2: an empty block must not ship its wrapper.
  describe('when htmlCode is empty', () => {
    const render = (htmlCode) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      host.innerHTML = showTemplate;
      ko.applyBindings(
        {
          id: ko.observable('ko_htmlCodeBlock_3'),
          htmlCode: ko.observable(htmlCode),
        },
        host
      );
      // Mirror the export cascade, in the same order as viewmodel.js exportHTML.
      const serialized = host.innerHTML
        .replace(/<!-- ko ((?!--).)*? -->/g, '')
        .replace(/<!-- \/ko -->/g, '')
        .replace(/ data-bind="[^"]*"/g, '');
      return stripEmptyHtmlCodeBlocks(serialized);
    };

    // The requirement: an empty block ships nothing whatsoever.
    it('exports absolutely nothing', () => {
      expect(render('')).toBe('');
    });

    it('leaves no empty block root behind', () => {
      expect(render('')).not.toContain('lp-html-block-root');
    });

    it('exports no cell, no row and no table', () => {
      const exported = render('');
      expect(exported).not.toMatch(/<t(able|r|d)/i);
    });

    it('exports no marker element either', () => {
      expect(render('')).not.toContain('class="lp-html-block"');
    });

    // The empty-state placeholder is an edit-mode affordance and must never
    // reach an export; it lives in block-wysiwyg.tmpl.html, not here.
    it('carries no empty-state placeholder', () => {
      expect(showTemplate).not.toContain('lp-html-block-empty');
      expect(showTemplate).not.toContain('html-code-block-empty');
    });
  });

  describe('when htmlCode is set', () => {
    // The pasted markup is injected by the lpHtmlCode binding, which goes through
    // ko.utils.setHtml — not exercisable under jsdom (Knockout's own `html`
    // binding fails there too), so the structure is asserted instead of rendered.
    it('hides the whole payload behind a single conditional', () => {
      const conditionals = showTemplate.match(/<!-- ko if:/g) || [];
      expect(conditionals).toHaveLength(1);
      expect(showTemplate).toMatch(/<!-- ko if: htmlCode\(\)/);
    });

    it('puts the marker element inside that conditional', () => {
      const ifIndex = showTemplate.indexOf('<!-- ko if:');
      // `class="lp-html-block"` exactly: a bare 'lp-html-block' search would
      // also hit 'lp-html-block-root' on the block root, before the conditional.
      const markerIndex = showTemplate.indexOf('class="lp-html-block"');
      const endIndex = showTemplate.indexOf('<!-- /ko -->');
      expect(ifIndex).toBeGreaterThan(-1);
      expect(markerIndex).toBeGreaterThan(ifIndex);
      expect(markerIndex).toBeLessThan(endIndex);
    });

    it('renders the markup through the lpHtmlCode binding', () => {
      expect(showTemplate).toMatch(/data-bind="[^"]*lpHtmlCode: htmlCode/);
    });
  });
});

// A mail that uses no HTML code block must export exactly what it did before the
// feature existed. The block definition is injected into every template
// unconditionally, so this is the guard that the injection is inert for everyone
// else.
describe('templates that do not use the block', () => {
  let withoutInjection;
  let withInjection;

  beforeAll(() => {
    withoutInjection = compile(TEMPLATE_WITH_NATIVE_BLOCK);
    withInjection = compile(injectHtmlCodeBlock(TEMPLATE_WITH_NATIVE_BLOCK));
  });

  it('generates a byte-identical template for a native block', () => {
    expect(withInjection['textBlock-show']).toBe(
      withoutInjection['textBlock-show']
    );
  });

  it('keeps the native block wysiwyg template identical too', () => {
    expect(withInjection['textBlock-wysiwyg']).toBe(
      withoutInjection['textBlock-wysiwyg']
    );
  });

  it('preserves the native block own alignment attributes', () => {
    expect(withInjection['textBlock-show']).toContain('align="center"');
    expect(withInjection['textBlock-show']).toContain('valign="top"');
  });

  it('adds the HTML block definitions without removing the native ones', () => {
    expect(Object.keys(withInjection)).toContain('textBlock-show');
    expect(Object.keys(withInjection)).toContain('htmlCodeBlock-show');
  });
});
