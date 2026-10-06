'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('../ownership');
const { blockTexts } = require('../exported-content');

const LOREM = /\blorem ipsum\b/i;
// Text properties by the naming convention of our templates, the one the
// translation extractor relies on (utils/block-content-extractor.js). A style
// value left at its default ("center", "Arial") is never sample text.
const TEXT_KEY = /(text|title|label|caption|content|heading|description)$/i;
const MIN_LENGTH = 3;
const EXCERPT_LENGTH = 60;
const normalize = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

// Every string of a block model, with its path.
function stringLeaves(value, path = []) {
  if (typeof value === 'string') return [{ path, value }];
  if (!value || typeof value !== 'object') return [];
  return _.flatMap(Object.keys(value), (key) =>
    stringLeaves(value[key], path.concat(key))
  );
}

// The text a rich-text value shows: tags dropped, entities decoded, in the
// inert export document so nothing is fetched.
function plainText(ctx, html) {
  const el = ctx.doc.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

const excerpt = (text) =>
  text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;

module.exports = {
  id: 'sample-text',
  category: 'copy',
  severity: 'error',
  titleKey: 'Sample texts',
  passKey: 'Every sample text of the template has been replaced',
  run(ctx) {
    const texts = blockTexts(ctx);
    return _.flatMap(ctx.blocks, (block) => {
      const shown = normalize(texts[block && block.id] || '');
      if (!shown) return [];
      if (LOREM.test(shown)) {
        return [
          {
            messageKey: 'Placeholder text (lorem ipsum) left in the block',
            blockId: block.id,
            value: 'lorem',
          },
        ];
      }
      // A text still equal to the template's default, and still shown: the
      // client kept the sample. Only a warning: a default label ("Shop now")
      // may be kept on purpose.
      const def = getBlockDefault(ctx.blockDefs, block.type);
      if (!def) return [];
      return stringLeaves(block)
        .filter(
          (leaf) =>
            TEXT_KEY.test(String(_.last(leaf.path))) &&
            leaf.value === _.get(def, leaf.path)
        )
        .map((leaf) => ({ ...leaf, text: plainText(ctx, leaf.value) }))
        .filter(
          (leaf) =>
            (leaf.text.match(/\p{L}/gu) || []).length >= MIN_LENGTH &&
            shown.includes(normalize(leaf.text))
        )
        .map((leaf) => ({
          messageKey: 'Sample text of the template not replaced: __text__',
          severity: 'warning',
          params: { text: excerpt(leaf.text) },
          blockId: block.id,
          propertyPath: leaf.path.join('.'),
          value: leaf.value,
        }));
    });
  },
};
