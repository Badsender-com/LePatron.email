'use strict';

const cheerio = require('cheerio');

const FIELD_ATTRIBUTES = ['data-ko-editable', 'data-ko-link'];

// Some content attributes — a link's URL, an image's alt text — aren't
// declared via a dedicated data-ko-* HTML attribute. Templates bind them
// through a `-ko-attr-<name>: @propertyPath` pseudo-property embedded in the
// element's `style` attribute instead (Mosaico's LESS-based authoring
// syntax — see TEMPLATE_DEVELOPER_GUIDE.md's "HTML Attribute Bindings").
// Only content-relevant attribute names are considered here; style/layout
// ones (width, padding, class, align, ...) bound the same way are
// intentionally excluded — they aren't content a feed item could fill in.
const KO_ATTR_CONTENT_NAMES = ['href', 'alt', 'src'];
const KO_ATTR_BINDING_PATTERN = new RegExp(
  `-ko-attr-(?:${KO_ATTR_CONTENT_NAMES.join(
    '|'
  )})\\s*:\\s*@\\[?\\(?\\s*([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)\\s*\\)?\\]?`,
  'g'
);

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

  $('[style]').each((_, element) => {
    const $el = $(element);
    const parentBlockName = $el
      .closest('[data-ko-block]')
      .attr('data-ko-block');
    if (parentBlockName !== blockName) return;

    const style = $el.attr('style') || '';
    KO_ATTR_BINDING_PATTERN.lastIndex = 0;
    let match;
    while ((match = KO_ATTR_BINDING_PATTERN.exec(style))) {
      fieldPaths.add(match[1]);
    }
  });

  return Array.from(fieldPaths);
}

module.exports = { listBlockNames, getBlockFieldPaths };
