'use strict';

const _ = require('lodash');
const ko = require('knockout');

// The tracking values the client filled in, as the tracking panel stores them.
function readTrackingUrls(viewModel) {
  try {
    return viewModel.content().tracking().trackingUrls() || [];
  } catch (_e) {
    return [];
  }
}

/**
 * The client's blocks, from every container of the content model: the
 * converter turns `data-ko-container="x"` into `xBlocks` (converter/parser.js).
 * Fixed blocks, declared outside any container, are the template's own.
 */
function collectBlocks(viewModel) {
  const content = viewModel.content() || {};
  return _.flatMap(
    Object.keys(content).filter((key) => /Blocks$/.test(key)),
    (key) => {
      const container = ko.toJS(content[key]);
      return container && Array.isArray(container.blocks)
        ? container.blocks
        : [];
    }
  );
}

/**
 * Builds what every rule reads: the exported HTML (exported and parsed once),
 * the plain content model, the editor's configuration and a way to trace an
 * exported node back to its block.
 */
function buildContext(viewModel, html) {
  const blocks = collectBlocks(viewModel);
  const blockIds = new Set(blocks.map((block) => block && block.id));
  // An inert document: unlike $.parseHTML, DOMParser never fetches the images.
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    html,
    doc,
    blocks,
    blockDefs: ko.toJS(viewModel.blockDefs) || [],
    trackingUrls: readTrackingUrls(viewModel),
    // The editor's configuration, read once: rules never reach the view model.
    config: {
      placeholderUrl: _.get(viewModel, 'metadata.imagesUrl.placeholder'),
      trackingConfig: _.get(viewModel, 'metadata.trackingConfig'),
    },
    // The block root keeps its `id` in the export (uniqueId + attr:{id}).
    // Anything outside a block root is the template's frame, not the client's.
    blockIdOf(node) {
      for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
        if (el.id && blockIds.has(el.id)) return el.id;
      }
      return null;
    },
  };
}

module.exports = {
  buildContext,
  readTrackingUrls,
};
