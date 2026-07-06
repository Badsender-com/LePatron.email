'use strict';

const cheerio = require('cheerio');

const FIELD_ATTRIBUTES = ['data-ko-editable', 'data-ko-link'];

/**
 * List distinct block names (`data-ko-block` values) present in a template's markup.
 * @param {string} markup
 * @returns {string[]}
 */
function listBlockNames(markup) {
  if (!markup || typeof markup !== 'string') return [];

  const $ = cheerio.load(markup);
  const blockNames = new Set();

  $('[data-ko-block]').each((_, element) => {
    const blockName = $(element).attr('data-ko-block');
    if (blockName) blockNames.add(blockName);
  });

  return Array.from(blockNames);
}

/**
 * List distinct field paths (`data-ko-editable`/`data-ko-link` values) found
 * anywhere inside the given block — across every rendered variant, e.g.
 * white-label brand fragments toggled by `data-ko-display` — since these
 * paths are exactly the property names Mosaico instantiates on a block
 * object, regardless of which variant is actually visible.
 * @param {string} markup
 * @param {string} blockName
 * @returns {string[]}
 */
function getBlockFieldPaths(markup, blockName) {
  if (!markup || typeof markup !== 'string' || !blockName) return [];

  const $ = cheerio.load(markup);
  const fieldPaths = new Set();

  FIELD_ATTRIBUTES.forEach((attribute) => {
    $(`[${attribute}]`).each((_, element) => {
      const $el = $(element);
      const parentBlockName = $el
        .closest('[data-ko-block]')
        .attr('data-ko-block');
      if (parentBlockName !== blockName) return;

      const fieldPath = $el.attr(attribute);
      if (fieldPath) fieldPaths.add(fieldPath);
    });
  });

  return Array.from(fieldPaths);
}

module.exports = { listBlockNames, getBlockFieldPaths };
