/**
 * @jest-environment jsdom
 */

'use strict';

// The engine attributes a finding to a block through the `id` of the block's
// root in the export. The other quality tests write that markup by hand; this
// one gets it from the REAL Mosaico converter and bindings, rendered the way
// the export renders a block, then stripped of its Knockout markup as
// viewmodel.js exportHTML strips it.

const jQuery = require('jquery');
const ko = require('knockout');

global.$ = global.jQuery = jQuery;
global.ko = ko;

const converter = require('../../../packages/editor/src/js/converter/main.js');
const templateSystem = require('../../../packages/editor/src/js/bindings/choose-template.js');
require('../../../packages/editor/src/js/bindings/virtuals.js');
require('../../../packages/editor/src/js/bindings/wysiwygs.js');
require('../../../packages/editor/src/js/bindings/scrollintoview.js');
const unfilledLinks = require('../../../packages/editor/src/js/ext/quality/rules/unfilled-links.js');
const { findingsOf } = require('./fake-view-model');

const TEMPLATE = [
  '<html><head><style type="text/css">@supports -ko-blockdefs {',
  '  text { label: Text; widget: text; }',
  '  url { label: Link; widget: url; }',
  '  link { label: Link; properties: text url; }',
  '  textBlock { label: Text Block; properties: text link; }',
  '}</style></head>',
  '<body><div data-ko-container="main" data-ko-wrap="false">',
  '<table class="vb-outer" width="100%" data-ko-block="textBlock"><tr><td>',
  '<div data-ko-editable="text">Hello</div>',
  '<a data-ko-link="link.url" href="#toreplace" data-ko-editable="link.text">Read more</a>',
  '</td></tr></table>',
  '</div></body></html>',
].join('');

// Mosaico replaces html/head/body before parsing so jQuery does not swallow them.
const markStructuralTags = (html) =>
  html.replace(
    /(<\/?)(html|head|body)([^>]*>)/gi,
    (match, open, tag, rest) => open + 'replaced' + tag + rest
  );

function compile(templateHtml) {
  templateSystem.init();
  let anonymous = 0;
  converter.translateTemplate(
    'template',
    markStructuralTags(templateHtml),
    () => null,
    (htmlOrElement, optionalName, templateMode) => {
      const name = optionalName
        ? optionalName + (templateMode ? '-' + templateMode : '')
        : 'anonymous-' + anonymous++;
      const html =
        typeof htmlOrElement === 'object'
          ? htmlOrElement.outerHTML
          : htmlOrElement;
      templateSystem.addTemplate(name, html);
      return name;
    }
  );
}

// One block rendered through its `-show` template, as the export renders it.
function exportBlock(block) {
  const host = document.createElement('div');
  host.innerHTML =
    "<!-- ko template: { name: 'textBlock-show', data: block } --><!-- /ko -->";
  const root = { block, isSelectedItem: () => false, selectItem: () => {} };
  ko.applyBindings(root, host);
  return host.innerHTML
    .replace(/<!-- ko ((?!--).)*? -->/g, '')
    .replace(/<!-- \/ko -->/g, '')
    .replace(/ data-bind="[^"]*"/g, '');
}

describe('a finding of the exported markup', () => {
  let block;
  let exported;

  beforeAll(() => {
    compile(TEMPLATE);
    block = {
      id: ko.observable(''),
      type: ko.observable('textBlock'),
      text: ko.observable('Hello'),
      link: ko.observable({
        url: ko.observable('#toreplace'),
        text: ko.observable('Read more'),
      }),
    };
    exported = exportBlock(block);
  });

  it('keeps the id of the block root', () => {
    expect(block.id()).toMatch(/^ko_textBlock_\d+$/);
    expect(exported).toMatch(new RegExp(`^<table[^>]* id="${block.id()}"`));
  });

  it('is attributed to its block, the frame around it never', () => {
    const html = `<!DOCTYPE html><html><body><a href="#toreplace">Footer</a>${exported}</body></html>`;
    const findings = findingsOf(unfilledLinks, {
      blocks: [ko.toJS(block)],
      html,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      blockId: block.id(),
      params: { label: 'Read more' },
    });
  });
});
