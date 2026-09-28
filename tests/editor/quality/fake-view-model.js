'use strict';

const ko = require('knockout');

/**
 * A view model shaped like the editor's, reduced to what quality checks read:
 * the blocks of the content model, the template's block definitions, the
 * exported HTML and the tracking configuration.
 */
function fakeViewModel({
  blocks = [],
  blockDefs = [],
  html = '<html><body></body></html>',
  trackingConfig,
  trackingUrls = [],
  imagesUrl = { placeholder: 'http://localhost:3000/api/images/placeholder/' },
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
      mainBlocks: () => ({
        blocks: ko.observableArray(blocks.map((b) => ko.observable(b))),
      }),
      tracking: () => ({ trackingUrls: () => trackingUrls }),
    }),
  };
}

// The export of a list of blocks: each block root keeps its id.
function exportOf(blockHtmls, { frame = '' } = {}) {
  const body = Object.keys(blockHtmls)
    .map((id) => `<div id="${id}">${blockHtmls[id]}</div>`)
    .join('');
  return `<!DOCTYPE html><html><body>${frame}${body}</body></html>`;
}

module.exports = { fakeViewModel, exportOf };
