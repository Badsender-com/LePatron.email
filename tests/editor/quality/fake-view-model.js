'use strict';

const ko = require('knockout');
const { mapValues } = require('lodash');
const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');

// A container of the content model, as Mosaico wraps it.
const container = (blocks) =>
  ko.observable({
    blocks: ko.observableArray(blocks.map((b) => ko.observable(b))),
  });

/**
 * A view model shaped like the editor's, reduced to what quality checks read:
 * the blocks of the content model (`blocks` fill `mainBlocks`, `containers`
 * add others, e.g. `{ footerBlocks: [...] }`), the template's block
 * definitions, the exported HTML and the tracking configuration.
 */
function fakeViewModel({
  blocks = [],
  blockDefs = [],
  html = '<html><body></body></html>',
  trackingConfig,
  trackingUrls = [],
  // As the editor gets it from the server (mailing.schema.js, imagesUrl).
  imagesUrl = {
    images: 'http://localhost:3000/api/images/',
    placeholder: 'http://localhost:3000/api/images/placeholder/',
  },
  containers = {},
} = {}) {
  const exportHTML = jest.fn(() => html);
  return {
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (text, name) => text.replace(`__${name}__`, params[name]),
        key
      ),
    exportHTML,
    blockDefs,
    metadata: { trackingConfig, imagesUrl },
    content: () => ({
      ...mapValues({ mainBlocks: blocks, ...containers }, container),
      tracking: () => ({ trackingUrls: () => trackingUrls }),
    }),
  };
}

/**
 * A view model with a subject (email metadata on) and a preheader, as the
 * copy rules read them. `rootContent` adds other root properties of the
 * content model (per-market preheaders, `preheaderVisible`).
 */
function copyViewModel({
  subjectValue,
  preheaderValue,
  preheaderDefault = '',
  rootContent = {},
  ...rest
} = {}) {
  const vm = fakeViewModel(rest);
  const content = vm.content;
  vm.content = () => ({
    ...content(),
    ...mapValues(rootContent, (value) => ko.observable(value)),
    ...(preheaderValue !== undefined && {
      preheaderText: ko.observable(preheaderValue),
    }),
  });
  vm.templateDefaults = { preheaderText: preheaderDefault };
  if (subjectValue !== undefined) {
    vm.emailMetadataStore = {
      isActive: () => true,
      snapshot: () => ({ subject: subjectValue }),
    };
  }
  return vm;
}

// The export of a list of blocks: each block root keeps its id.
function exportOf(blockHtmls, { frame = '' } = {}) {
  const body = Object.keys(blockHtmls)
    .map((id) => `<div id="${id}">${blockHtmls[id]}</div>`)
    .join('');
  return `<!DOCTYPE html><html><body>${frame}${body}</body></html>`;
}

// The findings of a single rule, run through the engine as the editor runs it.
function findingsOf(rule, vmOptions) {
  return runQualityChecks(fakeViewModel(vmOptions), { rules: [rule] }).findings;
}

const DEFAULT_RICH_TEXT = '<p style="font-size:12px">Sample</p>';

/**
 * The findings of a rule on a text block whose rich text the client wrote;
 * its export shows the same markup inside the template's cell, `cell` (a
 * `<td>` of background `bg` by default).
 */
function richTextFindings(
  rule,
  longText,
  { bg = '#ffffff', type = 'textBlock', cell } = {}
) {
  const td = cell || `<td bgcolor="${bg}">`;
  const html = exportOf({
    b1: `<table><tr>${td}${longText}</td></tr></table>`,
  });
  const blocks = [{ id: 'b1', type, longText }];
  const def = { type: 'textBlock', longText: DEFAULT_RICH_TEXT };
  const blockDefs = [def, { ...def, type }];
  return runQualityChecks(fakeViewModel({ blocks, blockDefs, html }), {
    rules: [rule],
  }).findings;
}

module.exports = {
  fakeViewModel,
  copyViewModel,
  exportOf,
  findingsOf,
  richTextFindings,
  DEFAULT_RICH_TEXT,
};
